import { and, asc, desc, eq, gt, inArray, max } from "drizzle-orm";
import type {
  AppendMessageInput,
  ConversationCrypto,
  ConversationId,
  Message,
  MessageId,
  MessageRepository,
  Rendering,
  WrappedDataKey,
} from "@nexus/core";
import { NexusError } from "@nexus/core";
import type { NexusDatabase } from "../client.js";
import { messages } from "../schema.js";
import { keyFor } from "./data-key.js";
import { toMessage } from "./mappers.js";

/**
 * Messages, encrypted at the database boundary.
 *
 * Callers hand over and receive plain `Rendering[]`. Ciphertext exists only
 * inside this class. That is the point: there is no code path where a
 * developer can forget to encrypt, because writing plaintext is not something
 * the type system here will let them express.
 */
export class DrizzleMessageRepository implements MessageRepository {
  readonly #db: NexusDatabase;
  readonly #crypto: ConversationCrypto;

  constructor(db: NexusDatabase, crypto: ConversationCrypto) {
    this.#db = db;
    this.#crypto = crypto;
  }

  async append(input: AppendMessageInput): Promise<Message> {
    if (input.renderings.length === 0) {
      throw NexusError.validation("A message must have at least one rendering");
    }

    const key = await keyFor(this.#db, input.conversationId);
    const sealed = await this.#crypto.encrypt(JSON.stringify(input.renderings), key, {
      conversationId: input.conversationId,
      purpose: "message",
    });

    const rows = await this.#db
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        authorRole: input.authorRole,
        authorId: input.authorId,
        originalLanguage: input.originalLanguage,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
        algorithm: sealed.algorithm,
        keyId: sealed.keyId,
        cipherVersion: sealed.version,
      })
      .returning();

    const row = rows[0];
    if (!row) throw new Error("Insert returned no message row");
    return toMessage(row, input.renderings);
  }

  async findById(id: MessageId): Promise<Message | null> {
    const rows = await this.#db
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const key = await keyFor(this.#db, row.conversationId as ConversationId);
    return toMessage(row, await this.#open(row, key));
  }

  async listForConversation(
    conversationId: ConversationId,
    options: { after?: Date; limit?: number } = {},
  ): Promise<readonly Message[]> {
    const predicates = [eq(messages.conversationId, conversationId)];
    if (options.after) predicates.push(gt(messages.sentAt, options.after));

    const rows = await this.#db
      .select()
      .from(messages)
      .where(and(...predicates))
      .orderBy(asc(messages.sentAt))
      .limit(options.limit ?? 200);

    if (rows.length === 0) return [];

    // One key lookup and one unwrap for the whole transcript, not one per row.
    const key = await keyFor(this.#db, conversationId);
    return Promise.all(
      rows.map(async (row) => toMessage(row, await this.#open(row, key))),
    );
  }

  async markFlagged(ids: readonly MessageId[]): Promise<void> {
    if (ids.length === 0) return;
    await this.#db
      .update(messages)
      .set({ flagged: true })
      .where(inArray(messages.id, [...ids]));
  }

  async lastSentAt(conversationId: ConversationId): Promise<Date | null> {
    // One indexed row, not a transcript. This is asked on every page load and
    // every poll, and reading a conversation to find out when it last moved
    // would decrypt the whole thing to look at a timestamp.
    const rows = await this.#db
      .select({ at: max(messages.sentAt) })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    return rows[0]?.at ?? null;
  }

  async mostRecentFor(conversationId: ConversationId): Promise<Message | null> {
    const rows = await this.#db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.sentAt))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const key = await keyFor(this.#db, conversationId);
    return toMessage(row, await this.#open(row, key));
  }

  async addRendering(id: MessageId, rendering: Rendering): Promise<Message> {
    const rows = await this.#db
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) throw NexusError.notFound("Message", id);

    const conversationId = row.conversationId as ConversationId;
    const key = await keyFor(this.#db, conversationId);
    const current = await this.#open(row, key);

    // Replace rather than append, so re-running a backfill is idempotent.
    const next: Rendering[] = [
      ...current.filter((r) => r.language !== rendering.language),
      rendering,
    ];

    const sealed = await this.#crypto.encrypt(JSON.stringify(next), key, {
      conversationId,
      purpose: "message",
    });

    const updated = await this.#db
      .update(messages)
      .set({
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
        algorithm: sealed.algorithm,
        keyId: sealed.keyId,
        cipherVersion: sealed.version,
      })
      .where(eq(messages.id, id))
      .returning();

    const updatedRow = updated[0];
    if (!updatedRow) throw NexusError.notFound("Message", id);
    return toMessage(updatedRow, next);
  }

  async #open(
    row: typeof messages.$inferSelect,
    key: WrappedDataKey,
  ): Promise<readonly Rendering[]> {
    const json = await this.#crypto.decrypt(
      {
        ciphertext: row.ciphertext,
        iv: row.iv,
        authTag: row.authTag,
        algorithm: row.algorithm,
        keyId: row.keyId,
        version: row.cipherVersion,
      },
      key,
      { conversationId: row.conversationId as ConversationId, purpose: "message" },
    );
    return JSON.parse(json) as Rendering[];
  }
}
