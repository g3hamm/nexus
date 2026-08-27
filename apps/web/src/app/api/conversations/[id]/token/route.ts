import { NexusError, asConversationId } from "@nexus/core";
import { container } from "@/server/container";
import { ConversationService } from "@/server/conversation-service";
import { errorResponse, ok } from "@/server/http";
import { seekerSession, staffSession } from "@/server/session";

export const runtime = "nodejs";

/**
 * Mint a realtime credential for one participant in one conversation.
 *
 * Always minted server-side and always scoped to a single room. The token
 * carries only the capabilities this conversation's modality needs, so a text
 * conversation's token cannot be replayed to publish video.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const c = container();
    const conversation = await c.conversations.findById(asConversationId(id));
    if (!conversation) throw NexusError.notFound("Conversation", id);

    const service = new ConversationService(c);

    const seeker = await seekerSession();
    if (seeker && seeker.subject === conversation.seekerId) {
      const grant = await service.accessTokenFor(
        conversation,
        seeker.subject,
        "seeker",
        // Volunteers see "Guest" and nothing more.
        "Guest",
      );
      return ok({ token: grant.token, url: grant.url, expiresAt: grant.expiresAt });
    }

    const staff = await staffSession();
    if (staff && conversation.volunteerId === staff.subject) {
      const grant = await service.accessTokenFor(
        conversation,
        staff.subject,
        "volunteer",
        staff.displayName,
      );
      return ok({ token: grant.token, url: grant.url, expiresAt: grant.expiresAt });
    }

    throw NexusError.forbidden("You are not part of this conversation");
  } catch (error) {
    return errorResponse(error);
  }
}
