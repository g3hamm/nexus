import { and, asc, eq, isNull, sql } from "drizzle-orm";
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
import { conversations } from "../schema.js";
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
