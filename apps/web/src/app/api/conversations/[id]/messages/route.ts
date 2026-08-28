import { after, type NextRequest } from "next/server";
import { z } from "zod";
import {
  NexusError,
  asConversationId,
  crisisResourcesFor,
  languageCodeSchema,
  RATE_LIMITS,
} from "@nexus/core";
import { container } from "@/server/container";
import { ConversationService } from "@/server/conversation-service";
import { ModerationService } from "@/server/moderation-service";
import { countryFor } from "@/server/geo";
import { errorResponse, ok } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
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
      crisis: crisisFor(participant, request),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * The crisis card's contents, or the absence of one.
 *
 * Delivered on the transcript response rather than pushed over the realtime
 * channel, for the same reason messages are: a data packet is spoofable, and
 * the polling fallback has to carry everything the socket does. A seeker on a
 * bad mobile connection is not a seeker who should miss this.
 *
 * The seeker gets resources for where they appear to be. The volunteer gets
 * the international directory and nothing more — we could only give them the
 * seeker's local numbers by storing the seeker's country, and a volunteer can
 * simply ask where someone is, which is a better conversation anyway.
 */
function crisisFor(
  participant: Awaited<ReturnType<typeof participantFor>>,
  request: NextRequest,
) {
  if (participant.conversation.crisisRaisedAt === null) return { active: false };

  const country = participant.role === "seeker" ? countryFor(request) : null;
  return {
    active: true,
    resources: crisisResourcesFor(country, participant.language),
  };
}

/** Send a message. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const participant = await participantFor(id);

    // Keyed on the participant, not the address: two people on one office
    // network must not throttle each other mid-conversation.
    await enforceRateLimit(
      request,
      RATE_LIMITS.sendMessage,
      participant.id ?? participant.conversation.seekerId,
    );

    const parsed = sendSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw NexusError.validation("A message must be between 1 and 4000 characters");
    }

    const c = container();
    const service = new ConversationService(c);
    const result = await service.send({
      conversationId: participant.conversation.id,
      authorRole: participant.role,
      authorId: participant.id,
      text: parsed.data.text,
      language: parsed.data.language ?? participant.language,
    });

    // The judge runs after the response is sent, never in front of it.
    // Moderation is important, but nobody should watch a spinner while a
    // second model decides whether their message was acceptable — and the
    // scheduler means most sends do no work here at all.
    after(async () => {
      await new ModerationService(c).reviewIfDue(participant.conversation.id);
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
