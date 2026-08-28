import "server-only";

import type { ConversationId, ConversationWindow, ModerationVerdict } from "@nexus/core";
import { requiresHumanReview } from "@nexus/core";
import type { Container } from "./container";

/**
 * What the volunteer is told when someone may be at risk.
 *
 * The wording depends on whether alerts actually go anywhere, because the
 * alternative is the software lying to a volunteer in the worst moment of
 * their week. "An administrator has been alerted" has to be true, and it is
 * only true when a webhook is configured. Where none is, the volunteer is
 * told plainly that they are the person here — which is the fact, and which
 * changes what a reasonable person does next.
 */
function crisisNotice(alertsDeliver: boolean): string {
  const shared =
    "Someone here may be at risk. Stay with them and take it seriously. " +
    "They can now see emergency numbers for where they are, on their own screen.";

  return alertsDeliver
    ? `${shared} An administrator has been alerted.`
    : `${shared} This is flagged for review, but nobody has been paged — right now you are the person here.`;
}

/**
 * Runs the judge and acts on what it says.
 *
 * The judge decides *what* is happening; this decides what the platform does
 * about it. Keeping those apart matters — the model's opinion should be
 * auditable on its own, separate from the enforcement built on top of it.
 */
export class ModerationService {
  readonly #c: Container;
  readonly #windowSize: number;

  constructor(container: Container, options: { windowSize?: number } = {}) {
    this.#c = container;
    this.#windowSize = options.windowSize ?? 30;
  }

  /**
   * Reviews a conversation if the schedule says it is due.
   *
   * Returns null when no review ran. Never throws into the caller: this runs
   * after a message has already been delivered, and a moderation failure must
   * not surface to the two people talking. It is logged instead.
   */
  async reviewIfDue(conversationId: ConversationId): Promise<ModerationVerdict | null> {
    try {
      const conversation = await this.#c.conversations.findById(conversationId);
      if (!conversation) return null;
      // Nothing to police in a conversation nobody can speak in any more.
      if (conversation.status !== "active" && conversation.status !== "waiting") {
        return null;
      }

      const messages = await this.#c.messages.listForConversation(conversationId, {
        limit: this.#windowSize,
      });

      const window: ConversationWindow = {
        conversationId,
        messages,
        volunteerLanguage: conversation.volunteerLanguage ?? "en",
        seekerLanguage: conversation.seekerLanguage,
      };

      if (
        !this.#c.moderationScheduler.shouldReview(window, conversation.lastModeratedAt)
      ) {
        return null;
      }

      const verdict = await this.#c.judge.review(window);
      await this.#c.conversations.markModerated(conversationId, new Date());

      await this.#act(conversationId, verdict);
      return verdict;
    } catch (error) {
      // Never let this reach the conversation. Being unable to moderate is a
      // problem for operators, not something to interrupt a seeker with.
      console.error("[nexus] moderation review failed", { conversationId, error });
      return null;
    }
  }

  async #act(conversationId: ConversationId, verdict: ModerationVerdict): Promise<void> {
    // Nothing to do, and nothing worth a database write.
    if (verdict.action === "none" || verdict.action === "monitor") return;

    const flag = await this.#c.flags.raise(conversationId, verdict);

    if (verdict.evidenceMessageIds.length > 0) {
      await this.#c.messages.markFlagged(verdict.evidenceMessageIds);
    }

    await this.#c.audit.record({
      action: "flag.raised",
      actorRole: "system",
      actorId: null,
      conversationId,
      detail: {
        flagId: flag.id,
        category: verdict.category,
        severity: verdict.severity,
        subject: verdict.subject,
        recommended: verdict.action,
        confidence: verdict.confidence,
      },
    });

    // Anything serious is held open for a human, which also exempts it from
    // the retention purge until someone has looked.
    if (requiresHumanReview(verdict)) {
      await this.#c.conversations.markUnderReview(conversationId);
    }

    const conversation = await this.#c.conversations.findById(conversationId);
    if (!conversation) return;

    if (verdict.action === "escalate_crisis") {
      // Durable first, and set-once, so the seeker's crisis card survives a
      // reload and a dropped connection. Everything after this is delivery,
      // and delivery is allowed to fail.
      await this.#c.conversations.markCrisis(conversationId, new Date());
      await this.#alert(conversationId);

      // Reaches the volunteer, who is the person actually able to help right
      // now. The seeker is not told they have been flagged — they came here
      // for a conversation, not to be handled — but they are shown the
      // numbers, which is care rather than handling.
      await this.#notify(conversation.roomId, "critical", crisisNotice(this.#c.alertsDeliver));
      return;
    }

    if (verdict.action === "terminate") {
      await this.#c.conversations.end(conversationId, "terminated");
      await this.#notify(
        conversation.roomId,
        "critical",
        "This conversation has been ended by Nexus and is under review.",
      );
      await this.#c.audit.record({
        action: "conversation.ended",
        actorRole: "system",
        actorId: null,
        conversationId,
        detail: { reason: "terminated by moderation", flagId: flag.id },
      });
      return;
    }

    if (verdict.action === "coach_volunteer") {
      await this.#notify(conversation.roomId, "low", verdict.rationale);
    }
  }

  /**
   * Rings the doorbell outside the app.
   *
   * Reserved for risk to life, and nothing else. Every other category the
   * judge can raise — coercion, solicitation, an abusive volunteer — is
   * serious and belongs in the flag queue, where an admin reviews it with the
   * transcript in front of them. Paging people for those would train everyone
   * to ignore the pager, and the one time it means someone might die is the
   * one time that must not happen.
   *
   * The alert carries an id and a link, never a word of what was said.
   *
   * The channel's contract says it will not throw, and the shipped adapters
   * hold to it — but this one call reaches a third party over the network,
   * and a `catch` here is the difference between a webhook outage costing us
   * the alert and it also costing the volunteer the notice that follows.
   * Everything after this point still has to run.
   */
  async #alert(conversationId: ConversationId): Promise<void> {
    const base = this.#c.publicUrl;
    try {
      await this.#c.alerts.send({
        severity: "urgent",
        title: "Someone on Nexus may be at risk of harm",
        detail:
          "A live conversation was escalated. Open it, decide whether anyone needs to step in, and check the volunteer is supported.",
        conversationId,
        ...(base ? { url: `${base}/admin/conversations/${conversationId}` } : {}),
      });
    } catch (error) {
      console.error("[nexus] crisis alert failed to send", { conversationId, error });
    }
  }

  /** Best effort. A dropped notice must not undo the flag that was raised. */
  async #notify(roomId: string, severity: string, text: string): Promise<void> {
    try {
      await this.#c.realtime.publishEvent(roomId as never, {
        type: "moderation_notice",
        severity,
        text,
      });
    } catch {
      // The flag is already durable, which is the part that matters.
    }
  }
}
