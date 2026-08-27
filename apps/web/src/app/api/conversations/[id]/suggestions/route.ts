import { NexusError, asConversationId, formatReference } from "@nexus/core";
import { container } from "@/server/container";
import { errorResponse, ok } from "@/server/http";
import { staffSession } from "@/server/session";

export const runtime = "nodejs";
// Retrieval plus a careful model call. Comfortably longer than a chat turn.
export const maxDuration = 60;

/**
 * Suggestions for the volunteer's sidebar.
 *
 * Volunteer-only, and only for a conversation they were actually matched
 * with. A seeker must never be able to fetch this — being shown the notes
 * someone is keeping about you mid-conversation would be a small betrayal of
 * what this is supposed to be.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const claims = await staffSession();
    if (!claims) throw NexusError.unauthorized("Sign in to continue");

    const c = container();
    const conversation = await c.conversations.findById(asConversationId(id));
    if (!conversation) throw NexusError.notFound("Conversation", id);
    if (conversation.volunteerId !== claims.subject) {
      throw NexusError.forbidden("You are not part of this conversation");
    }

    const messages = await c.messages.listForConversation(conversation.id, {
      limit: 20,
    });

    // Nothing said yet, so nothing worth spending a model call on.
    if (messages.length === 0) {
      return ok({ ready: false, verses: [], discussionPoints: [], sources: [] });
    }

    const suggestions = await c.enablement.suggest({
      conversationId: conversation.id,
      messages,
      volunteerLanguage: conversation.volunteerLanguage ?? "en",
      seekerLanguage: conversation.seekerLanguage,
    });

    return ok({
      ready: true,
      verses: suggestions.verses.map((v) => ({
        reference: formatReference(v.reference),
        rationale: v.rationale,
        preview: v.preview,
      })),
      discussionPoints: suggestions.discussionPoints,
      understanding: suggestions.understanding,
      sources: suggestions.sources.map((s) => ({
        title: s.chunk.title,
        source: s.chunk.source,
        score: Math.round(s.score * 100) / 100,
      })),
      generatedAt: suggestions.generatedAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
