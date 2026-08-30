import { eq } from "drizzle-orm";
import type {
  CachedFullSuggestions,
  CachedVerseSuggestions,
  ConversationCrypto,
  ConversationId,
  DiscussionPoint,
  EnablementCacheEntry,
  EnablementCacheRepository,
  EnablementSuggestions,
  RetrievedChunk,
  SeekerUnderstanding,
  SuggestedVerse,
} from "@nexus/core";
import type { NexusDatabase } from "../client.js";
import { enablementCache } from "../schema.js";
import { keyFor } from "./data-key.js";

/** What's actually encrypted for each tier — `generatedAt`/`messageCount` stay plain columns. */
interface FullPayload {
  readonly verses: readonly SuggestedVerse[];
  readonly discussionPoints: readonly DiscussionPoint[];
  readonly understanding: SeekerUnderstanding;
  readonly sources: readonly RetrievedChunk[];
}
interface VersesPayload {
  readonly verses: readonly SuggestedVerse[];
}

type Row = typeof enablementCache.$inferSelect;

/**
 * Cached sidebar suggestions, one row per conversation.
 *
 * Both `writeFull` and `writeVerses` upsert rather than update: either tier
 * can be the first to write a given conversation's row (a seeker can send
 * several messages, and so trigger a verses refresh, before a volunteer ever
 * opens the panel to bootstrap the full tier), and a plain `UPDATE` against a
 * row that does not exist yet would silently affect nothing. Each upsert's
 * `set` lists only its own tier's columns, so the frequent write and the rare
 * one can never clobber each other.
 */
export class DrizzleEnablementCacheRepository implements EnablementCacheRepository {
  readonly #db: NexusDatabase;
  readonly #crypto: ConversationCrypto;

  constructor(db: NexusDatabase, crypto: ConversationCrypto) {
    this.#db = db;
    this.#crypto = crypto;
  }

  async find(conversationId: ConversationId): Promise<EnablementCacheEntry> {
    const rows = await this.#db
      .select()
      .from(enablementCache)
      .where(eq(enablementCache.conversationId, conversationId))
      .limit(1);

    const row = rows[0];
    if (!row) return { full: null, verses: null };

    // Fetched at most once, and only if either tier is actually present.
    const key =
      row.fullCiphertext !== null || row.versesCiphertext !== null
        ? await keyFor(this.#db, conversationId)
        : null;

    return {
      full: await this.#openFull(row, conversationId, key),
      verses: await this.#openVerses(row, conversationId, key),
    };
  }

  async writeFull(
    conversationId: ConversationId,
    suggestions: EnablementSuggestions,
    messageCount: number,
  ): Promise<void> {
    const key = await keyFor(this.#db, conversationId);
    const payload: FullPayload = {
      verses: suggestions.verses,
      discussionPoints: suggestions.discussionPoints,
      understanding: suggestions.understanding,
      sources: suggestions.sources,
    };
    const sealed = await this.#crypto.encrypt(JSON.stringify(payload), key, {
      conversationId,
      purpose: "enablement_full",
    });

    const set = {
      fullCiphertext: sealed.ciphertext,
      fullIv: sealed.iv,
      fullAuthTag: sealed.authTag,
      fullAlgorithm: sealed.algorithm,
      fullKeyId: sealed.keyId,
      fullCipherVersion: sealed.version,
      fullGeneratedAt: suggestions.generatedAt,
      fullMessageCount: messageCount,
    };

    await this.#db
      .insert(enablementCache)
      .values({ conversationId, ...set })
      .onConflictDoUpdate({ target: enablementCache.conversationId, set });
  }

  async writeVerses(
    conversationId: ConversationId,
    verses: readonly SuggestedVerse[],
    generatedAt: Date,
    messageCount: number,
  ): Promise<void> {
    const key = await keyFor(this.#db, conversationId);
    const payload: VersesPayload = { verses };
    const sealed = await this.#crypto.encrypt(JSON.stringify(payload), key, {
      conversationId,
      purpose: "enablement_verses",
    });

    const set = {
      versesCiphertext: sealed.ciphertext,
      versesIv: sealed.iv,
      versesAuthTag: sealed.authTag,
      versesAlgorithm: sealed.algorithm,
      versesKeyId: sealed.keyId,
      versesCipherVersion: sealed.version,
      versesGeneratedAt: generatedAt,
      versesMessageCount: messageCount,
    };

    await this.#db
      .insert(enablementCache)
      .values({ conversationId, ...set })
      .onConflictDoUpdate({ target: enablementCache.conversationId, set });
  }

  async #openFull(
    row: Row,
    conversationId: ConversationId,
    key: Awaited<ReturnType<typeof keyFor>> | null,
  ): Promise<CachedFullSuggestions | null> {
    if (
      row.fullCiphertext === null ||
      row.fullIv === null ||
      row.fullAuthTag === null ||
      row.fullAlgorithm === null ||
      row.fullKeyId === null ||
      row.fullCipherVersion === null ||
      row.fullGeneratedAt === null ||
      row.fullMessageCount === null ||
      key === null
    ) {
      return null;
    }

    const json = await this.#crypto.decrypt(
      {
        ciphertext: row.fullCiphertext,
        iv: row.fullIv,
        authTag: row.fullAuthTag,
        algorithm: row.fullAlgorithm,
        keyId: row.fullKeyId,
        version: row.fullCipherVersion,
      },
      key,
      { conversationId, purpose: "enablement_full" },
    );
    const payload = JSON.parse(json) as FullPayload;

    return {
      ...payload,
      generatedAt: row.fullGeneratedAt,
      messageCount: row.fullMessageCount,
    };
  }

  async #openVerses(
    row: Row,
    conversationId: ConversationId,
    key: Awaited<ReturnType<typeof keyFor>> | null,
  ): Promise<CachedVerseSuggestions | null> {
    if (
      row.versesCiphertext === null ||
      row.versesIv === null ||
      row.versesAuthTag === null ||
      row.versesAlgorithm === null ||
      row.versesKeyId === null ||
      row.versesCipherVersion === null ||
      row.versesGeneratedAt === null ||
      row.versesMessageCount === null ||
      key === null
    ) {
      return null;
    }

    const json = await this.#crypto.decrypt(
      {
        ciphertext: row.versesCiphertext,
        iv: row.versesIv,
        authTag: row.versesAuthTag,
        algorithm: row.versesAlgorithm,
        keyId: row.versesKeyId,
        version: row.versesCipherVersion,
      },
      key,
      { conversationId, purpose: "enablement_verses" },
    );
    const payload = JSON.parse(json) as VersesPayload;

    return {
      verses: payload.verses,
      generatedAt: row.versesGeneratedAt,
      messageCount: row.versesMessageCount,
    };
  }
}
