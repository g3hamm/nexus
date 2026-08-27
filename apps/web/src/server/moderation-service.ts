import "server-only";

import type { ConversationId, ConversationWindow, ModerationVerdict } from "@nexus/core";
import { requiresHumanReview } from "@nexus/core";
import type { Container } from "./container";

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
      // Reaches the volunteer, who is the person actually able to help right
      // now. The seeker is not told they have been flagged — they came here
      // for a conversation, not to be handled.
      await this.#notify(
        conversation.roomId,
        "critical",
        "Someone may be at risk. Stay with them, take it seriously, and " +
          "encourage local emergency help. An administrator has been alerted.",
      );
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
