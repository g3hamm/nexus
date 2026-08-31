import { eq } from "drizzle-orm";
import type { ConversationId, WrappedDataKey } from "@nexus/core";
import { NexusError } from "@nexus/core";
import type { NexusDatabase } from "../client.js";
import { conversations } from "../schema.js";

/**
 * The wrapped data key for a conversation, for content encrypted under it.
 *
 * Every content-bearing repository needs this — messages, flags, and now
 * cached enablement suggestions all encrypt under the *conversation's* key
 * rather than one of their own, so a conversation stays one unit of access
 * regardless of how many kinds of content are attached to it. Shared here
 * rather than reimplemented per repository, which is what happened before:
 * this exact query existed three times over.
 */
/**
 * Keys already looked up.
 *
 * A conversation's wrapped key is written once, when the conversation is
 * created, and no code path ever updates it — so a value read here can never
 * go stale, and re-reading it is pure latency. That mattered: a single
 * transcript load fetched the same key twice, once to decrypt the
 * conversation and once to decrypt its messages, and over Neon's HTTP
 * driver every one of those is a separate round trip.
 *
 * Bounded, because a long-lived instance would otherwise hold a key per
 * conversation it has ever served. Eviction is oldest-first and the cost of
 * being wrong is one extra query, so nothing cleverer is warranted.
 *
 * This is the wrapped key, not the data key — it is useless without the KMS
 * that unwraps it, which is the whole point of wrapping it.
 */
const KEYS = new Map<string, WrappedDataKey>();
const MAX_CACHED_KEYS = 500;

export async function keyFor(
  db: NexusDatabase,
  conversationId: ConversationId,
): Promise<WrappedDataKey> {
  const cached = KEYS.get(conversationId);
  if (cached) return cached;

  const rows = await db
    .select({ wrapped: conversations.wrappedKey, keyId: conversations.keyId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  const row = rows[0];
  if (!row) throw NexusError.notFound("Conversation", conversationId);

  const key = { wrapped: row.wrapped, keyId: row.keyId };
  if (KEYS.size >= MAX_CACHED_KEYS) {
    const oldest = KEYS.keys().next().value;
    if (oldest !== undefined) KEYS.delete(oldest);
  }
  KEYS.set(conversationId, key);
  return key;
}

/**
 * Forget a conversation's key.
 *
 * Called when a conversation is destroyed, so a purge does not leave its
 * key sitting in a live instance's memory afterwards.
 */
export function forgetKey(conversationId: ConversationId): void {
  KEYS.delete(conversationId);
}
