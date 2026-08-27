import { asVolunteerId, endonym } from "@nexus/core";
import { container } from "@/server/container";
import { errorResponse, ok } from "@/server/http";
import { requireVolunteer } from "@/server/session";

export const runtime = "nodejs";

/**
 * What a volunteer sees when they sign in: who is waiting, and for how long.
 *
 * No message content — a volunteer has not been matched yet, so they have no
 * business reading what someone has written. Language and wait time are
 * enough to decide whether to take the conversation.
 */
export async function GET() {
  try {
    const claims = await requireVolunteer();
    const c = container();

    const [waiting, mine] = await Promise.all([
      c.conversations.findWaiting(25),
      c.conversations.findActiveForVolunteer(asVolunteerId(claims.subject)),
    ]);

    return ok({
      waiting: waiting.map((conversation) => ({
        id: conversation.id,
        language: conversation.seekerLanguage,
        languageName: endonym(conversation.seekerLanguage),
        waitingSince: conversation.startedAt.toISOString(),
      })),
      active: mine.map((conversation) => ({
        id: conversation.id,
        language: conversation.seekerLanguage,
        languageName: endonym(conversation.seekerLanguage),
        matchedAt: conversation.matchedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
