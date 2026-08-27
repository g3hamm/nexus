import "server-only";

import type {
  AdminId,
  ConversationId,
  FlagId,
  ModerationFlag,
  Volunteer,
  VolunteerId,
} from "@nexus/core";
import { NexusError, renderingFor } from "@nexus/core";
import type { Container } from "./container";

/**
 * How long a conversation is kept once a flag on it has been reviewed.
 *
 * Reviewing a flag has to put the conversation back on a clock. `markUnderReview`
 * nulls `retainUntil` to keep the purge away from evidence, and without a
 * counterpart every flag the judge raises would retain a transcript forever —
 * undoing the retention policy one flag at a time.
 *
 * The two windows differ because the reasons differ. A dismissed flag means
 * nothing happened, so the conversation goes back to the ordinary window. An
 * upheld one is a record of misconduct that a ministry may need months later,
 * for a safeguarding process or a decision about a volunteer — but "may need
 * it" is not a reason to keep a seeker's transcript indefinitely, so it is a
 * long window rather than no window at all.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
export const RETENTION_AFTER_DISMISSAL_DAYS = 90;
export const RETENTION_AFTER_UPHELD_DAYS = 365;

export interface TranscriptLine {
  readonly id: string;
  readonly authorRole: string;
  readonly originalText: string;
  readonly originalLanguage: string;
  readonly englishText: string | null;
  readonly sentAt: string;
  readonly flagged: boolean;
}

/**
 * Everything an admin can do.
 *
 * The rule this class exists to enforce: **reading a transcript is an audited
 * event.** "Admins can audit conversations" and "admins are themselves
 * audited" have to be the same feature, or the audit trail protects only the
 * people who are not looking at it. `transcriptFor` is the only way to read a
 * conversation as an admin, and it cannot be called without writing the read
 * to the audit log first.
 */
export class AdminService {
  readonly #c: Container;

  constructor(container: Container) {
    this.#c = container;
  }

  async openFlags(limit = 50): Promise<readonly ModerationFlag[]> {
    return this.#c.flags.listOpen(limit);
  }

  async resolvedFlags(limit = 25): Promise<readonly ModerationFlag[]> {
    return this.#c.flags.listResolved(limit);
  }

  /**
   * The full transcript, decrypted, with the read recorded.
   *
   * The audit entry is written *before* the messages are returned. If the
   * write fails the read does not happen — an unauditable read of a seeker's
   * conversation is exactly what this system is supposed to make impossible.
   */
  async transcriptFor(
    conversationId: ConversationId,
    adminId: AdminId,
    reason: "review" | "export" = "review",
  ): Promise<{
    readonly lines: readonly TranscriptLine[];
    readonly flags: readonly ModerationFlag[];
  }> {
    const conversation = await this.#c.conversations.findById(conversationId);
    if (!conversation) throw NexusError.notFound("Conversation", conversationId);

    await this.#c.audit.record({
      action: reason === "export" ? "conversation.exported" : "conversation.viewed",
      actorRole: "admin",
      actorId: adminId,
      conversationId,
      detail: { status: conversation.status },
    });

    const [messages, flags] = await Promise.all([
      this.#c.messages.listForConversation(conversationId, { limit: 500 }),
      this.#c.flags.listForConversation(conversationId),
    ]);

    return {
      lines: messages.map((message) => {
        const original = message.renderings.find((r) => r.source === "original");
        const english = renderingFor(message, "en");
        return {
          id: message.id,
          authorRole: message.authorRole,
          originalText: original?.text ?? english.text,
          originalLanguage: original?.language ?? english.language,
          // An admin reviewing a Farsi conversation needs both: the English to
          // understand it, and the original because the translation is a
          // machine's opinion and may be the thing that went wrong.
          englishText: english.text === original?.text ? null : english.text,
          sentAt: message.sentAt.toISOString(),
          flagged: message.flagged,
        };
      }),
      flags,
    };
  }

  /**
   * Records a decision on a flag and puts the conversation back on a clock.
   *
   * Both halves matter. Resolving without restoring retention leaves the
   * transcript exempt from the purge forever.
   */
  async resolveFlag(
    flagId: FlagId,
    adminId: AdminId,
    status: "upheld" | "dismissed",
    note: string,
  ): Promise<void> {
    const flag = await this.#c.flags.findById(flagId);
    if (!flag) throw NexusError.notFound("Flag", flagId);
    if (flag.status === "upheld" || flag.status === "dismissed") {
      throw NexusError.conflict("This flag has already been reviewed");
    }

    await this.#c.flags.resolve(flagId, adminId, status, note);

    // Only once nothing unresolved is left on the conversation. Two flags on
    // one conversation must both be dealt with before it stops being evidence.
    const remaining = await this.#c.flags.listForConversation(flag.conversationId);
    const stillOpen = remaining.some(
      (f) => f.id !== flagId && (f.status === "open" || f.status === "reviewing"),
    );

    if (!stillOpen) {
      const days =
        status === "upheld"
          ? RETENTION_AFTER_UPHELD_DAYS
          : RETENTION_AFTER_DISMISSAL_DAYS;
      await this.#c.conversations.restoreRetention(
        flag.conversationId,
        new Date(Date.now() + days * DAY_MS),
      );
    }

    await this.#c.audit.record({
      action: "flag.resolved",
      actorRole: "admin",
      actorId: adminId,
      conversationId: flag.conversationId,
      detail: {
        flagId,
        decision: status,
        category: flag.verdict.category,
        severity: flag.verdict.severity,
        retentionRestored: !stillOpen,
      },
    });
  }

  async volunteers(limit = 100): Promise<readonly Volunteer[]> {
    return this.#c.volunteers.listAll(limit);
  }

  async setVolunteerApproved(
    volunteerId: VolunteerId,
    adminId: AdminId,
    approved: boolean,
  ): Promise<void> {
    await this.#c.volunteers.setApproved(volunteerId, approved);
    await this.#c.audit.record({
      action: "volunteer.approved",
      actorRole: "admin",
      actorId: adminId,
      conversationId: null,
      detail: { volunteerId, approved },
    });
  }

  async setVolunteerSuspended(
    volunteerId: VolunteerId,
    adminId: AdminId,
    suspended: boolean,
  ): Promise<void> {
    await this.#c.volunteers.setSuspended(volunteerId, suspended);
    await this.#c.audit.record({
      action: "volunteer.suspended",
      actorRole: "admin",
      actorId: adminId,
      conversationId: null,
      detail: { volunteerId, suspended },
    });
  }

  /** The audit trail itself, including other admins' reads. */
  async auditTrail(options: { conversationId?: ConversationId; limit?: number } = {}) {
    return this.#c.audit.list({
      ...(options.conversationId ? { conversationId: options.conversationId } : {}),
      limit: options.limit ?? 100,
    });
  }
}
