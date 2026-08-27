import { and, asc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type {
  Conversation,
  ConversationCrypto,
  ConversationId,
  ConversationRepository,
  CreateConversationInput,
  LanguageCode,
  VolunteerId,
} from "@nexus/core";
import { asConversationId, sameLanguage } from "@nexus/core";
import type { NexusDatabase } from "../client.js";
import { conversations, moderationFlags } from "../schema.js";
import { toConversation } from "./mappers.js";

export class DrizzleConversationRepository implements ConversationRepository {
  readonly #db: NexusDatabase;
  readonly #crypto: ConversationCrypto;

  constructor(db: NexusDatabase, crypto: ConversationCrypto) {
    this.#db = db;
    this.#crypto = crypto;
  }

  async create(input: CreateConversationInput): Promise<Conversation> {
    // The id is needed before insert, because it is bound into the encryption
    // context of this conversation's data key.
    const id = asConversationId(crypto.randomUUID());
    const dataKey = await this.#crypto.createDataKey(id);

    const rows = await this.#db
      .insert(conversations)
      .values({
        id,
        seekerId: input.seekerId,
        seekerLanguage: input.seekerLanguage,
        modality: input.modality,
        status: "waiting",
        // The room is named after the conversation so the two are never out of
        // step, and so a room name leaks nothing about who is in it.
        roomId: `nexus-${id}`,
        wrappedKey: dataKey.wrapped,
        keyId: dataKey.keyId,
        retainUntil: input.retainUntil,
      })
      .returning();

    const row = rows[0];
    if (!row) throw new Error("Insert returned no conversation row");
    return toConversation(row);
  }

  async findById(id: ConversationId): Promise<Conversation | null> {
    const rows = await this.#db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    const row = rows[0];
    return row ? toConversation(row) : null;
  }

  async findWaiting(limit: number): Promise<readonly Conversation[]> {
    const rows = await this.#db
      .select()
      .from(conversations)
      .where(and(eq(conversations.status, "waiting"), isNull(conversations.volunteerId)))
      // Oldest first: nobody should be overtaken in the queue.
      .orderBy(asc(conversations.startedAt))
      .limit(limit);
    return rows.map(toConversation);
  }

  async findActiveForVolunteer(
    volunteerId: VolunteerId,
  ): Promise<readonly Conversation[]> {
    const rows = await this.#db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.volunteerId, volunteerId),
          eq(conversations.status, "active"),
        ),
      )
      .orderBy(asc(conversations.matchedAt));
    return rows.map(toConversation);
  }

  /**
   * Claim a waiting conversation.
   *
   * The `status = 'waiting' AND volunteer_id IS NULL` predicate is the whole
   * concurrency story: two volunteers hitting Accept at the same instant both
   * run this UPDATE, exactly one matches a row, and the loser gets null back
   * and is offered the next conversation. No transaction, no lock, no race.
   */
  async claim(
    id: ConversationId,
    volunteerId: VolunteerId,
    volunteerLanguage: LanguageCode,
  ): Promise<Conversation | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const rows = await this.#db
      .update(conversations)
      .set({
        volunteerId,
        volunteerLanguage,
        status: "active",
        matchedAt: sql`now()`,
        translationRequired: !sameLanguage(existing.seekerLanguage, volunteerLanguage),
      })
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.status, "waiting"),
          isNull(conversations.volunteerId),
        ),
      )
      .returning();

    const row = rows[0];
    return row ? toConversation(row) : null;
  }

  async end(id: ConversationId, reason: "ended" | "terminated"): Promise<void> {
    await this.#db
      .update(conversations)
      .set({ status: reason, endedAt: sql`now()` })
      .where(eq(conversations.id, id));
  }

  async markUnderReview(id: ConversationId): Promise<void> {
    await this.#db
      .update(conversations)
      .set({
        status: "under_review",
        // A conversation awaiting review must outlive the retention window.
        retainUntil: null,
      })
      .where(eq(conversations.id, id));
  }

  /**
   * Returns a reviewed conversation to a normal status and a retention clock.
   *
   * Status is derived rather than remembered: a conversation that has an
   * `ended_at` goes back to "ended", one that does not is still live and goes
   * back to "active". Storing the pre-review status would be one more field to
   * keep correct for no gain.
   *
   * `terminated` is deliberately untouched — a conversation Nexus ended stays
   * ended, whatever an admin decides about the flag.
   */
  async restoreRetention(id: ConversationId, retainUntil: Date): Promise<void> {
    await this.#db
      .update(conversations)
      .set({
        retainUntil,
        status: sql`case when ${conversations.endedAt} is null then 'active'::conversation_status
                        else 'ended'::conversation_status end`,
      })
      .where(and(eq(conversations.id, id), eq(conversations.status, "under_review")));
  }

  async markModerated(id: ConversationId, at: Date): Promise<void> {
    await this.#db
      .update(conversations)
      .set({ lastModeratedAt: at })
      .where(eq(conversations.id, id));
  }

  /**
   * Conversations that have aged out and can be destroyed.
   *
   * The three exclusions are the whole safety of this operation:
   *   - `under_review` never qualifies, whatever the date says.
   *   - Nor does anything with an open or in-progress moderation flag, even
   *     if the conversation itself looks finished.
   *   - Nor does a null `retainUntil`, which is what raising a flag sets and
   *     what "keep indefinitely" means.
   */
  async findPurgeable(now: Date, limit: number): Promise<readonly ConversationId[]> {
    const rows = await this.#db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          inArray(conversations.status, ["ended", "terminated"]),
          isNotNull(conversations.retainUntil),
          lt(conversations.retainUntil, now),
          sql`not exists (
            select 1 from ${moderationFlags}
            where ${moderationFlags.conversationId} = ${conversations.id}
              and ${moderationFlags.status} in ('open', 'reviewing')
          )`,
        ),
      )
      // Oldest first, so a long-delayed purge works through the backlog in order.
      .orderBy(asc(conversations.retainUntil))
      .limit(limit);

    return rows.map((row) => asConversationId(row.id));
  }

  /**
   * Destroys conversations and everything that belongs to them.
   *
   * A hard delete. Anything softer — a deleted flag, a nulled column — leaves
   * the transcript sitting in the table for anyone with database access, which
   * is exactly the person this is meant to protect against.
   *
   * There is a second effect worth knowing about. The conversation row holds
   * the only copy of that conversation's wrapped data key. Deleting it
   * destroys the key, so any message ciphertext that somehow outlives this
   * call — in a replica, a backup, a WAL segment — is permanently
   * undecryptable rather than merely deleted. That is the property that makes
   * this genuinely a deletion and not a hope.
   */
  async purge(ids: readonly ConversationId[]): Promise<number> {
    if (ids.length === 0) return 0;

    // Messages and flags cascade from the conversation's foreign keys, so one
    // delete is enough and there is no window where a message row outlives
    // the key that decrypts it.
    const deleted = await this.#db
      .delete(conversations)
      .where(inArray(conversations.id, [...ids]))
      .returning({ id: conversations.id });

    return deleted.length;
  }

  /** Internal: the wrapped data key for a conversation, for message crypto. */
  async keyFor(id: ConversationId): Promise<{ wrapped: string; keyId: string } | null> {
    const rows = await this.#db
      .select({ wrapped: conversations.wrappedKey, keyId: conversations.keyId })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    return rows[0] ?? null;
  }
}
