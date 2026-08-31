import { and, asc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type {
  Conversation,
  ConversationCrypto,
  WrappedDataKey,
  ConversationId,
  ConversationRepository,
  CreateConversationInput,
  CreatePracticeInput,
  LanguageCode,
  VolunteerId,
} from "@nexus/core";
import {
  ACTIVE_IDLE_MS,
  WAITING_IDLE_MS,
  asConversationId,
  sameLanguage,
} from "@nexus/core";
import type { NexusDatabase } from "../client.js";
import { forgetKey } from "./data-key.js";
import { conversations, messages, moderationFlags } from "../schema.js";
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
        ...(await this.#sealName(id, dataKey, input.seekerName)),
      })
      .returning();

    const row = rows[0];
    if (!row) throw new Error("Insert returned no conversation row");
    return this.#decrypted(row);
  }

  /**
   * Encrypts the chosen name, or returns nothing to store.
   *
   * Under `seeker_metadata` rather than `message`, so a name ciphertext and a
   * message ciphertext can never be substituted for one another — the same
   * reason flag rationales have their own purpose.
   */
  async #sealName(
    conversationId: ConversationId,
    key: WrappedDataKey,
    name: string | undefined,
  ) {
    const trimmed = name?.trim();
    if (!trimmed) return {};

    const sealed = await this.#crypto.encrypt(trimmed, key, {
      conversationId,
      purpose: "seeker_metadata",
    });

    return {
      seekerNameCiphertext: sealed.ciphertext,
      seekerNameIv: sealed.iv,
      seekerNameAuthTag: sealed.authTag,
      seekerNameAlgorithm: sealed.algorithm,
      seekerNameKeyId: sealed.keyId,
      seekerNameCipherVersion: sealed.version,
    };
  }

  /**
   * A row plus its decrypted name.
   *
   * Every read goes through here, so nothing above this line has to remember
   * that the name is encrypted. The data-key cache means a queue polling the
   * same conversations every few seconds pays for one unwrap each, not one
   * per poll.
   */
  async #decrypted(row: typeof conversations.$inferSelect): Promise<Conversation> {
    const conversation = toConversation(row);
    if (!row.seekerNameCiphertext) return conversation;

    try {
      const seekerName = await this.#crypto.decrypt(
        {
          ciphertext: row.seekerNameCiphertext,
          iv: row.seekerNameIv ?? "",
          authTag: row.seekerNameAuthTag ?? "",
          algorithm: row.seekerNameAlgorithm ?? "",
          keyId: row.seekerNameKeyId ?? "",
          version: row.seekerNameCipherVersion ?? 1,
        },
        { wrapped: row.wrappedKey, keyId: row.keyId },
        { conversationId: conversation.id, purpose: "seeker_metadata" },
      );
      return { ...conversation, seekerName };
    } catch (error) {
      // A name that will not decrypt must not take down the conversation it
      // belongs to. Losing how to address someone is a bad afternoon; losing
      // the ability to open their transcript is a different order of problem.
      console.error("[nexus] could not decrypt seeker name", {
        conversationId: conversation.id,
        error,
      });
      return conversation;
    }
  }

  /**
   * Opens a practice session, already matched to the volunteer running it.
   *
   * It gets its own data key and its own encrypted transcript like any other
   * conversation. That is not ceremony: a volunteer rehearsing the self-harm
   * scenario writes the same kind of thing they would write to a real person,
   * and their own fumbling first attempts are not something to leave lying
   * around in plaintext for the next administrator to read.
   */
  async createPractice(input: CreatePracticeInput): Promise<Conversation> {
    const id = asConversationId(crypto.randomUUID());
    const dataKey = await this.#crypto.createDataKey(id);

    const rows = await this.#db
      .insert(conversations)
      .values({
        id,
        // A handle in the same shape as a real seeker's, so nothing
        // downstream has to special-case it — but derived from the
        // conversation, since there is nobody on the other end to identify.
        seekerId: `practice_${id}`,
        volunteerId: input.volunteerId,
        volunteerLanguage: input.volunteerLanguage,
        seekerLanguage: input.seekerLanguage,
        translationRequired: !sameLanguage(input.seekerLanguage, input.volunteerLanguage),
        // Born active. There is no queue to wait in.
        status: "active",
        matchedAt: sql`now()`,
        modality: "text",
        roomId: `nexus-${id}`,
        wrappedKey: dataKey.wrapped,
        keyId: dataKey.keyId,
        practiceScenario: input.scenario,
        retainUntil: input.retainUntil,
      })
      .returning();

    const row = rows[0];
    if (!row) throw new Error("Insert returned no practice conversation row");
    return this.#decrypted(row);
  }

  async findById(id: ConversationId): Promise<Conversation | null> {
    const rows = await this.#db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    const row = rows[0];
    return row ? await this.#decrypted(row) : null;
  }

  async findWaiting(limit: number): Promise<readonly Conversation[]> {
    const rows = await this.#db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.status, "waiting"),
          isNull(conversations.volunteerId),
          // Belt and braces. Practice sessions are born matched so they
          // cannot reach this query anyway, but a volunteer looking for
          // someone who needs help must never be handed an exercise.
          isNull(conversations.practiceScenario),
          // Nor somebody who left twelve hours ago. The sweep closes these,
          // but it runs nightly and the queue is read constantly; without
          // this a volunteer coming on at breakfast is handed conversations
          // that expired in the night and end the moment they open them.
          notIdle(),
        ),
      )
      // Oldest first: nobody should be overtaken in the queue.
      .orderBy(asc(conversations.startedAt))
      .limit(limit);
    return Promise.all(rows.map((row) => this.#decrypted(row)));
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
    return Promise.all(rows.map((row) => this.#decrypted(row)));
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
    return row ? await this.#decrypted(row) : null;
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

  /**
   * Records that someone in this conversation may be at risk.
   *
   * `is null` in the predicate makes this set-once: the first escalation wins
   * and later ones are no-ops, so the timestamp keeps meaning "when we first
   * knew" rather than drifting forward with every subsequent review.
   */
  async markCrisis(id: ConversationId, at: Date): Promise<void> {
    await this.#db
      .update(conversations)
      .set({ crisisRaisedAt: at })
      .where(and(eq(conversations.id, id), isNull(conversations.crisisRaisedAt)));
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
  /**
   * Live conversations that have gone quiet past their limit.
   *
   * The idle clock runs from the last thing anybody said, falling back to
   * when the conversation opened — a seeker whose very first message failed
   * to send should not sit in the queue forever on the strength of having
   * arrived.
   *
   * The limits are inlined here as intervals rather than passed in, because
   * this has to be one indexed query rather than a transcript read per live
   * conversation. `expiry.ts` holds the same two numbers and is what the rest
   * of the app reasons with; the test below is what keeps them honest.
   */
  async findIdle(now: Date, limit: number): Promise<readonly ConversationId[]> {
    const rows = await this.#db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          inArray(conversations.status, ["waiting", "active"]),
          sql`not (${notIdle(now)})`,
        ),
      )
      // Oldest first, so a delayed sweep works through the backlog in order.
      .orderBy(asc(conversations.startedAt))
      .limit(limit);

    return rows.map((row) => asConversationId(row.id));
  }

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

    // The row is gone; drop the remembered wrapped key with it, so a
    // long-lived instance is not still holding one for a conversation this
    // call was supposed to make permanently undecryptable.
    for (const id of ids) forgetKey(id);

    return deleted.length;
  }
}

/**
 * True for a conversation that has not yet gone quiet past its limit.
 *
 * One fragment, used by the queue and by the sweep, so the two can never
 * disagree about which conversations are still alive — the queue offering a
 * volunteer a conversation the sweep is about to close is exactly the bug
 * this shape rules out.
 *
 * The clock runs from the last thing anybody said, falling back to when the
 * conversation opened: a seeker whose very first message never landed should
 * not hold a place in the queue on the strength of having arrived. The two
 * limits mirror `expiry.ts`, which is what the rest of the app reasons with.
 */
function notIdle(now?: Date) {
  const at = now ? sql`${now}::timestamptz` : sql`now()`;
  const waiting = sql.raw(String(WAITING_IDLE_MS / 3_600_000));
  const active = sql.raw(String(ACTIVE_IDLE_MS / 3_600_000));

  return sql`greatest(
    ${conversations.startedAt},
    coalesce(
      (select max(${messages.sentAt}) from ${messages}
       where ${messages.conversationId} = ${conversations.id}),
      ${conversations.startedAt}
    )
  ) >= ${at} - (
    case ${conversations.status}
      when 'waiting' then interval '${waiting} hours'
      else interval '${active} hours'
    end
  )`;
}
