import "server-only";

import type { Conversation } from "@nexus/core";
import { hasGoneIdle, isLive, linkHasExpired } from "@nexus/core";
import type { Container } from "./container";

/**
 * Closes conversations that have gone quiet, and shuts their links.
 *
 * Two entry points because there are two moments that matter, and only one of
 * them can be trusted.
 *
 * `resolve` runs on every read — the chat pages and the messages API — and is
 * what actually enforces the policy. A sweep on a schedule always leaves a
 * window, and "the link stopped working an hour after the cron happened to
 * run" is not a rule anybody can reason about. Doing it at the door means the
 * answer is the same whether or not anything else is working.
 *
 * `sweep` runs on the cron and is housekeeping: it takes abandoned
 * conversations out of the volunteer queue and puts them on a retention clock,
 * which read-time checks alone would never do for a conversation nobody ever
 * opens again.
 */
export class ExpiryService {
  readonly #c: Container;

  constructor(container: Container) {
    this.#c = container;
  }

  /**
   * The conversation as a reader may have it, or null when the link is done.
   *
   * A conversation that has gone idle is closed here and then returned, still
   * readable — closing it starts the grace period rather than ending access.
   * Somebody coming back to a conversation that timed out overnight should
   * find the last thing that was said to them, and be told plainly that it is
   * over, rather than meeting a door that no longer opens.
   */
  async resolve(
    conversation: Conversation,
    now = new Date(),
  ): Promise<Conversation | null> {
    if (linkHasExpired(conversation, now)) return null;
    if (!isLive(conversation)) return conversation;

    const lastSentAt = await this.#c.messages.lastSentAt(conversation.id);
    // Falling back to when it opened: a seeker whose very first message never
    // landed should not hold a live conversation open indefinitely.
    if (!hasGoneIdle(conversation, lastSentAt ?? conversation.startedAt, now)) {
      return conversation;
    }

    await this.#close(conversation);

    // Returned rather than re-read. The database stamps `ended_at` from its
    // own clock and this uses ours; an hour of grace does not care about the
    // milliseconds between them, and the alternative is another round trip on
    // every page load.
    return { ...conversation, status: "ended", endedAt: now };
  }

  /** Closes every conversation that has been silent past its limit. */
  async sweep(now = new Date(), limit = 500): Promise<number> {
    const ids = await this.#c.conversations.findIdle(now, limit);

    let closed = 0;
    for (const id of ids) {
      const conversation = await this.#c.conversations.findById(id);
      if (!conversation || !isLive(conversation)) continue;
      await this.#close(conversation);
      closed += 1;
    }

    return closed;
  }

  /**
   * Ends it, and says so in the audit log.
   *
   * Recorded as its own action rather than a normal end, because "the seeker
   * stopped replying" and "the volunteer said goodbye" are different facts
   * about a conversation and an administrator reading back through one should
   * be able to tell them apart.
   */
  async #close(conversation: Conversation): Promise<void> {
    await this.#c.conversations.end(conversation.id, "ended");

    try {
      await this.#c.audit.record({
        action: "conversation.expired",
        actorRole: "system",
        actorId: null,
        conversationId: conversation.id,
        detail: { status: conversation.status },
      });
    } catch (error) {
      // The conversation is closed either way, which is the part that
      // protects anybody. Losing the note is not worth failing the read that
      // triggered it.
      console.error("[nexus] could not record an expiry", {
        conversationId: conversation.id,
        error,
      });
    }
  }
}
