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
import { EnablementCacheService } from "@/server/enablement-cache-service";
import { ModerationService } from "@/server/moderation-service";
import { PracticeService } from "@/server/practice-service";
import { countryFor } from "@/server/geo";
import { ExpiryService } from "@/server/expiry-service";
import { errorResponse, ok } from "@/server/http";
import { firstName } from "@/server/names";
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
  const found = await c.conversations.findById(asConversationId(conversationId));
  if (!found) throw NexusError.notFound("Conversation", conversationId);

  const seeker = await seekerSession();
  const staff = seeker ? null : await staffSession();

  const participant =
    seeker && seeker.subject === found.seekerId
      ? {
          role: "seeker" as const,
          id: null,
          language: seeker.language ?? found.seekerLanguage,
        }
      : staff && found.volunteerId === staff.subject
        ? {
            role: "volunteer" as const,
            id: staff.subject,
            language: found.volunteerLanguage ?? "en",
          }
        : null;

  if (!participant) throw NexusError.forbidden("You are not part of this conversation");

  // Only after membership is established, so nobody can close somebody else's
  // conversation by poking at its id. A conversation past its link expiry is
  // reported as missing rather than forbidden: whether that id was ever real
  // is not something a dead link should still be answering.
  const conversation = await new ExpiryService(c).resolve(found);
  if (!conversation) throw NexusError.notFound("Conversation", conversationId);

  return { conversation, ...participant };
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

    // Three independent lookups, run together rather than one after the
    // other. Over Neon's HTTP driver each one is its own round trip, and
    // this endpoint is polled for the life of every open conversation — so
    // the difference between awaiting these in sequence and in parallel is
    // most of what the transcript's latency was.
    const [messages, peerName, coverage] = await Promise.all([
      service.transcriptFor(
        participant.conversation.id,
        participant.language,
        after && !Number.isNaN(after.getTime()) ? { after } : {},
      ),
      peerNameFor(participant),
      coverageFor(participant),
    ]);

    return ok({
      messages,
      conversation: {
        id: participant.conversation.id,
        status: participant.conversation.status,
        matched: participant.conversation.volunteerId !== null,
        peerName,
      },
      crisis: crisisFor(participant, request),
      coverage,
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
 * The volunteer's first name, from a seeker's side, once one exists.
 *
 * Only computed for a seeker, and only once matched: a volunteer already
 * knows the seeker's chosen name from the page itself (fixed for the life of
 * the conversation, since a seeker is attached at creation), but the seeker
 * has no volunteer to name until one claims the conversation — which can
 * happen while this page is already open. Carried on the same poll that
 * already flips `matched` live, rather than fixed at page load, so the name
 * appears the moment someone picks the conversation up instead of only after
 * a reload.
 */
async function peerNameFor(participant: Awaited<ReturnType<typeof participantFor>>) {
  if (participant.role !== "seeker") return null;
  if (participant.conversation.volunteerId === null) return null;

  const volunteer = await container().volunteers.findById(
    participant.conversation.volunteerId,
  );
  return volunteer ? firstName(volunteer.displayName) : null;
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

    // Everything below runs after the response is sent, never in front of it.
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
      // Independent model calls, run together rather than one after the
      // other, both still bounded by this route's own maxDuration. Verses
      // refresh only for a seeker's own message — nothing new for the
      // volunteer's suggestions to react to in their own reply. A practice
      // conversation never reaches here at all: its simulated seeker turns
      // are produced by `PracticeService` calling `ConversationService.send`
      // directly, never through this route, so the branch above already
      // excludes it without needing to check again.
      await Promise.all([
        new ModerationService(c).reviewIfDue(participant.conversation.id),
        participant.role === "seeker"
          ? new EnablementCacheService(c).refreshVerses(participant.conversation.id)
          : Promise.resolve(),
      ]);
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
