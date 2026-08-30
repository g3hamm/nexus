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
export async function keyFor(
  db: NexusDatabase,
  conversationId: ConversationId,
): Promise<WrappedDataKey> {
  const rows = await db
    .select({ wrapped: conversations.wrappedKey, keyId: conversations.keyId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  const row = rows[0];
  if (!row) throw NexusError.notFound("Conversation", conversationId);
  return { wrapped: row.wrapped, keyId: row.keyId };
}
