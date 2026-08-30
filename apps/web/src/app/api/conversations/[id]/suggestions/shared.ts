import { NexusError, asConversationId, formatReference } from "@nexus/core";
import type { Conversation } from "@nexus/core";
import { container } from "@/server/container";
import type { MergedSuggestions } from "@/server/enablement-cache-service";
import { staffSession } from "@/server/session";

/**
 * Resolves who is asking and confirms they were actually matched with this
 * conversation. Shared by the read and the force-refresh routes so the two
 * can never drift on who is allowed to ask — a seeker must never reach
 * either, and neither can a volunteer who was not the one matched here.
 */
export async function requireMatchedVolunteer(id: string): Promise<Conversation> {
  const claims = await staffSession();
  if (!claims) throw NexusError.unauthorized("Sign in to continue");

  const conversation = await container().conversations.findById(asConversationId(id));
  if (!conversation) throw NexusError.notFound("Conversation", id);
  if (conversation.volunteerId !== claims.subject) {
    throw NexusError.forbidden("You are not part of this conversation");
  }
  return conversation;
}

/**
 * The response shape the sidebar has always received — unchanged by the
 * cache underneath it. `understanding` and `generatedAt` are omitted
 * entirely rather than sent as `null`, matching the original "nothing said
 * yet" response exactly, since the client's own type treats them as
 * optional rather than nullable.
 */
export function toWire(suggestions: MergedSuggestions) {
  return {
    ready: suggestions.ready,
    verses: suggestions.verses.map((v) => ({
      reference: formatReference(v.reference),
      rationale: v.rationale,
      preview: v.preview,
    })),
    discussionPoints: suggestions.discussionPoints,
    ...(suggestions.understanding ? { understanding: suggestions.understanding } : {}),
    sources: suggestions.sources.map((s) => ({
      title: s.chunk.title,
      source: s.chunk.source,
      score: Math.round(s.score * 100) / 100,
    })),
    ...(suggestions.generatedAt
      ? { generatedAt: suggestions.generatedAt.toISOString() }
      : {}),
  };
}
