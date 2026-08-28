import type { ConversationId } from "../domain/ids.js";

/**
 * Reaching a human operator, right now, outside the app.
 *
 * The flag queue is where moderation goes to be reviewed carefully. This is
 * the other thing — the case where careful review tomorrow is the wrong
 * answer and somebody needs to know within the minute. Right now that is
 * only ever a risk to someone's life.
 *
 * It is a port because the way a church reaches its own people is a local
 * decision: a Teams channel, Slack, a pager, an SMS gateway, all of it
 * eventually. The platform should not care which.
 */
export type AlertSeverity = "info" | "urgent";

/**
 * An alert, deliberately shaped so it cannot carry the conversation.
 *
 * There is no message text, no transcript, no seeker language, and no
 * excerpt. That is not an omission to be filled in later — it is the point.
 * Webhooks land in third-party chat tools that are outside our encryption,
 * outside our retention policy, and readable by everyone in the channel. An
 * alert says *that* something is happening and *where to look*; the content
 * stays in the database, behind the admin login, where it is encrypted and
 * audited.
 */
export interface OperationalAlert {
  readonly severity: AlertSeverity;
  /** A short line a person will read on a phone screen. */
  readonly title: string;
  /** What to do about it. Never quotes anyone. */
  readonly detail: string;
  /** The conversation to open. An identifier, not content. */
  readonly conversationId?: ConversationId;
  /** Deep link to the admin view, when the deployment knows its own origin. */
  readonly url?: string;
}

export interface AlertChannel {
  /**
   * Best effort by contract.
   *
   * Implementations must not throw: an alert that fails to deliver must never
   * roll back the durable record it was announcing. Callers treat delivery as
   * an improvement on the flag queue, never as a replacement for it.
   */
  send(alert: OperationalAlert): Promise<void>;
}
