import "server-only";

import type { ConversationId } from "@nexus/core";
import type { Container } from "./container";

export interface PurgeResult {
  readonly examined: number;
  readonly purged: number;
  readonly batches: number;
  readonly reachedLimit: boolean;
}

/**
 * Destroys conversations whose retention window has closed.
 *
 * This is the control that makes `retainUntil` mean something. Without it the
 * column is a statement of intent, and a transcript that someone took a real
 * risk to create sits in the database forever.
 *
 * Works in bounded batches with an overall ceiling, so a purge that has not
 * run for a month does not attempt a year of deletions in one transaction and
 * time out — leaving nothing deleted and no obvious sign why.
 */
export class RetentionService {
  readonly #c: Container;
  readonly #batchSize: number;
  readonly #maxPerRun: number;

  constructor(
    container: Container,
    options: { batchSize?: number; maxPerRun?: number } = {},
  ) {
    this.#c = container;
    this.#batchSize = options.batchSize ?? 200;
    this.#maxPerRun = options.maxPerRun ?? 5_000;
  }

  async purgeExpired(now = new Date()): Promise<PurgeResult> {
    let purged = 0;
    let examined = 0;
    let batches = 0;

    while (purged < this.#maxPerRun) {
      const remaining = this.#maxPerRun - purged;
      const batch = await this.#c.conversations.findPurgeable(
        now,
        Math.min(this.#batchSize, remaining),
      );

      examined += batch.length;
      if (batch.length === 0) break;

      const removed = await this.#c.conversations.purge(batch);
      purged += removed;
      batches += 1;

      await this.#recordPurge(batch, removed);

      // A short batch means the queue is drained.
      if (batch.length < this.#batchSize) break;
    }

    return {
      examined,
      purged,
      batches,
      reachedLimit: purged >= this.#maxPerRun,
    };
  }

  /**
   * Records that a purge happened, and how much.
   *
   * Conversation ids are recorded rather than any content — the point of the
   * entry is to prove deletion occurred and to make a purge that removed far
   * more than expected visible after the fact. Writing anything from inside
   * the conversations would defeat the deletion.
   */
  async #recordPurge(ids: readonly ConversationId[], removed: number): Promise<void> {
    await this.#c.audit.record({
      action: "conversation.purged",
      actorRole: "system",
      actorId: null,
      conversationId: null,
      detail: {
        requested: ids.length,
        removed,
        // Truncated: the audit log should not become a second index of who
        // talked to us and when.
        sample: ids.slice(0, 5),
      },
    });
  }
}
