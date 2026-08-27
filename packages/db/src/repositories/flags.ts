import { asc, eq } from "drizzle-orm";
import type {
  AdminId,
  ConversationCrypto,
  ConversationId,
  FlagId,
  FlagRepository,
  ModerationAction,
  ModerationCategory,
  ModerationFlag,
  ModerationSeverity,
  ModerationVerdict,
  FlagSubject,
  MessageId,
  WrappedDataKey,
} from "@nexus/core";
import { NexusError, asFlagId, asConversationId } from "@nexus/core";
import type { NexusDatabase } from "../client.js";
import { conversations, moderationFlags } from "../schema.js";

export class DrizzleFlagRepository implements FlagRepository {
  readonly #db: NexusDatabase;
  readonly #crypto: ConversationCrypto;

  constructor(db: NexusDatabase, crypto: ConversationCrypto) {
    this.#db = db;
    this.#crypto = crypto;
  }

  async raise(
    conversationId: ConversationId,
    verdict: ModerationVerdict,
  ): Promise<ModerationFlag> {
    const key = await this.#keyFor(conversationId);
    // The rationale quotes the conversation, so it is encrypted with the same
    // conversation key — under a distinct purpose, so a message ciphertext and
    // a rationale ciphertext can never be swapped for one another.
    const sealed = await this.#crypto.encrypt(verdict.rationale, key, {
      conversationId,
      purpose: "flag_evidence",
    });

    const rows = await this.#db
      .insert(moderationFlags)
      .values({
        conversationId,
        category: verdict.category,
        severity: verdict.severity,
        subject: verdict.subject,
        rationaleCiphertext: sealed.ciphertext,
        rationaleIv: sealed.iv,
        rationaleAuthTag: sealed.authTag,
        rationaleAlgorithm: sealed.algorithm,
        rationaleKeyId: sealed.keyId,
        rationaleCipherVersion: sealed.version,
        action: verdict.action,
        evidenceMessageIds: [...verdict.evidenceMessageIds],
        confidence: verdict.confidence,
        status: "open",
      })
      .returning();

    const row = rows[0];
    if (!row) throw new Error("Insert returned no flag row");
    return this.#toFlag(row, verdict.rationale);
  }

  async findById(id: FlagId): Promise<ModerationFlag | null> {
    const rows = await this.#db
      .select()
      .from(moderationFlags)
      .where(eq(moderationFlags.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return this.#toFlag(row, await this.#openRationale(row));
  }

  async listOpen(limit: number): Promise<readonly ModerationFlag[]> {
    const rows = await this.#db
      .select()
      .from(moderationFlags)
      .where(eq(moderationFlags.status, "open"))
      // Oldest first: a flag that has waited longest is reviewed first.
      .orderBy(asc(moderationFlags.raisedAt))
      .limit(limit);

    return Promise.all(
      rows.map(async (row) => this.#toFlag(row, await this.#openRationale(row))),
    );
  }

  async resolve(
    id: FlagId,
    adminId: AdminId,
    status: "upheld" | "dismissed",
    note: string,
  ): Promise<void> {
    await this.#db
      .update(moderationFlags)
      .set({
        status,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: note,
      })
      .where(eq(moderationFlags.id, id));
  }

  async #keyFor(conversationId: ConversationId): Promise<WrappedDataKey> {
    const rows = await this.#db
      .select({ wrapped: conversations.wrappedKey, keyId: conversations.keyId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    const row = rows[0];
    if (!row) throw NexusError.notFound("Conversation", conversationId);
    return { wrapped: row.wrapped, keyId: row.keyId };
  }

  async #openRationale(row: typeof moderationFlags.$inferSelect): Promise<string> {
    const conversationId = asConversationId(row.conversationId);
    const key = await this.#keyFor(conversationId);
    return this.#crypto.decrypt(
      {
        ciphertext: row.rationaleCiphertext,
        iv: row.rationaleIv,
        authTag: row.rationaleAuthTag,
        algorithm: row.rationaleAlgorithm,
        keyId: row.rationaleKeyId,
        version: row.rationaleCipherVersion,
      },
      key,
      { conversationId, purpose: "flag_evidence" },
    );
  }

  #toFlag(row: typeof moderationFlags.$inferSelect, rationale: string): ModerationFlag {
    return {
      id: asFlagId(row.id),
      conversationId: asConversationId(row.conversationId),
      verdict: {
        category: (row.category as ModerationCategory | null) ?? null,
        severity: row.severity as ModerationSeverity,
        subject: row.subject as FlagSubject,
        rationale,
        action: row.action as ModerationAction,
        evidenceMessageIds: row.evidenceMessageIds as MessageId[],
        confidence: row.confidence,
      },
      status: row.status,
      raisedAt: row.raisedAt,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      reviewNote: row.reviewNote,
    };
  }
}
