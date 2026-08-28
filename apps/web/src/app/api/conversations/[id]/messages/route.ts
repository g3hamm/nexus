import { after, type NextRequest } from "next/server";
import { z } from "zod";
import {
  NexusError,
  asConversationId,
  crisisResourcesFor,
  isPractice,
  languageCodeSchema,
  RATE_LIMITS,
} from "@nexus/core";
import { container } from "@/server/container";
import { ConversationService } from "@/server/conversation-service";
import { ModerationService } from "@/server/moderation-service";
import { PracticeService } from "@/server/practice-service";
import { countryFor } from "@/server/geo";
import { errorResponse, ok } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { seekerSession, staffSession } from "@/server/session";

export const runtime = "nodejs";

/**
 * Long enough for the work that happens after the reply is sent.
 *
 * Without this the route ran on the platform default of a few seconds, and
 * everything in `after()` was killed mid-flight: the judge never finished, and
 * a practice partner never answered. Both of those swallow their own errors by
 * design — moderation must not surface to the people talking — so the failure
 * was completely silent. A message send can carry a translation in the request
 * path plus a judge pass or a partner reply behind it, and each of those is a
 * model call.
 */
export const maxDuration = 60;

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
      coverage: await coverageFor(participant),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Whether anyone is on, for a seeker who is still waiting.
 *
 * Only computed for an unmatched seeker: once someone has picked the
 * conversation up the question is answered, and a volunteer does not need to
 * be told how thin the rota is while they are mid-conversation.
 *
 * Fails to null rather than throwing. A coverage lookup is a nicety on top of
 * a transcript; it must never be the reason a message fails to load.
 */
async function coverageFor(participant: Awaited<ReturnType<typeof participantFor>>) {
  if (participant.role !== "seeker") return null;
  if (participant.conversation.volunteerId !== null) return null;

  try {
    // The count is operational detail. The seeker gets the word, not the
    // number — how thinly a ministry is staffed is not something a person in
    // distress benefits from knowing, in either direction.
    const { state } = await container().volunteers.coverage();
    return { state };
  } catch (error) {
    console.error("[nexus] coverage lookup failed", { error });
    return null;
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

    // Both of these run after the response is sent, never in front of it.
    //
    // In a real conversation the judge looks, and the scheduler means most
    // sends do no work at all — nobody should watch a spinner while a second
    // model decides whether their message was acceptable. In a practice
    // session the other side answers instead, and the judge never runs.
    after(async () => {
      if (isPractice(participant.conversation)) {
        await new PracticeService(c).respond(participant.conversation.id);
        return;
      }
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
