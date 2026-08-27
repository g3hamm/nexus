import type { NextRequest } from "next/server";
import { z } from "zod";
import { NexusError, asConversationId, asVolunteerId } from "@nexus/core";
import { container } from "@/server/container";
import { ConversationService } from "@/server/conversation-service";
import { errorResponse, ok } from "@/server/http";
import { requireVolunteer } from "@/server/session";

export const runtime = "nodejs";

const bodySchema = z.object({ conversationId: z.string().min(1) });

/**
 * A volunteer takes a waiting conversation.
 *
 * Losing the race to another volunteer returns 409 rather than an error page.
 * Two people hitting Accept at the same moment is normal, and the client
 * simply refreshes the queue.
 */
export async function POST(request: NextRequest) {
  try {
    const claims = await requireVolunteer();
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw NexusError.validation("conversationId is required");

    const c = container();
    const volunteer = await c.volunteers.findById(asVolunteerId(claims.subject));
    if (!volunteer) throw NexusError.notFound("Volunteer", claims.subject);

    const service = new ConversationService(c);
    const claimed = await service.claimForVolunteer(
      asConversationId(parsed.data.conversationId),
      volunteer,
    );

    if (!claimed) {
      throw NexusError.conflict("Another volunteer just took this conversation");
    }

    return ok({ conversationId: claimed.id, seekerLanguage: claimed.seekerLanguage });
  } catch (error) {
    return errorResponse(error);
  }
}
