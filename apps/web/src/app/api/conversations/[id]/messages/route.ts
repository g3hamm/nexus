import type { NextRequest } from "next/server";
import { z } from "zod";
import { NexusError, asConversationId, languageCodeSchema } from "@nexus/core";
import { container } from "@/server/container";
import { ConversationService } from "@/server/conversation-service";
import { errorResponse, ok } from "@/server/http";
import { seekerSession, staffSession } from "@/server/session";

export const runtime = "nodejs";

const sendSchema = z.object({
  text: z.string().min(1).max(4000),
  language: languageCodeSchema.optional(),
});

/**
 * Resolve who is asking and confirm they belong to this conversation.
 *
 * Both roles go through the same check. A volunteer's session does not grant
 * access to conversations they were not matched with — an authenticated
 * volunteer reading arbitrary transcripts would defeat the entire audit model.
 */
async function participantFor(conversationId: string) {
  const c = container();
  const conversation = await c.conversations.findById(asConversationId(conversationId));
  if (!conversation) throw NexusError.notFound("Conversation", conversationId);

  const seeker = await seekerSession();
  if (seeker && seeker.subject === conversation.seekerId) {
    return {
      conversation,
      role: "seeker" as const,
      id: null,
      language: seeker.language ?? conversation.seekerLanguage,
    };
  }

  const staff = await staffSession();
  if (staff && conversation.volunteerId === staff.subject) {
    return {
      conversation,
      role: "volunteer" as const,
      id: staff.subject,
      language: conversation.volunteerLanguage ?? "en",
    };
  }

  throw NexusError.forbidden("You are not part of this conversation");
}

/** The transcript, in the reader's language. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const participant = await participantFor(id);
    const service = new ConversationService(container());

    const afterRaw = request.nextUrl.searchParams.get("after");
    const after = afterRaw ? new Date(afterRaw) : undefined;

    const messages = await service.transcriptFor(
      participant.conversation.id,
      participant.language,
      after && !Number.isNaN(after.getTime()) ? { after } : {},
    );

    return ok({
      messages,
      conversation: {
        id: participant.conversation.id,
        status: participant.conversation.status,
        matched: participant.conversation.volunteerId !== null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Send a message. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const participant = await participantFor(id);

    const parsed = sendSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw NexusError.validation("A message must be between 1 and 4000 characters");
    }

    const service = new ConversationService(container());
    const result = await service.send({
      conversationId: participant.conversation.id,
      authorRole: participant.role,
      authorId: participant.id,
      text: parsed.data.text,
      language: parsed.data.language ?? participant.language,
    });

    return ok(
      {
        id: result.message.id,
        sentAt: result.message.sentAt.toISOString(),
        translationDegraded: result.translationDegraded,
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
