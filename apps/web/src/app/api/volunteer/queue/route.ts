import {
  asVolunteerId,
  endonym,
  isPractice,
  renderingFor,
  type Conversation,
} from "@nexus/core";
import { container, type Container } from "@/server/container";
import { errorResponse, ok } from "@/server/http";
import { requireVolunteer } from "@/server/session";

export const runtime = "nodejs";

/** Short enough for a dashboard row, not a second transcript. */
const PREVIEW_LENGTH = 80;

/**
 * What a volunteer sees when they sign in: who is waiting, and for how long.
 *
 * `waiting` carries no message content — a volunteer has not been matched
 * yet, so they have no business reading what someone has written. A chosen
 * name, a language and a wait time are enough to decide whether to take the
 * conversation.
 *
 * `active` is different: these are conversations the volunteer is already
 * matched with and can already read in full the moment they open one, so a
 * short preview of the last line is a convenience, not a new exposure — it
 * just saves opening each one to see who needs a reply. It also carries the
 * volunteer's own practice sessions, which live in the same table and the
 * same query, hence the `practice` flag on each entry.
 *
 * The name is included before matching on purpose. It is the one thing on this
 * screen that says a person is waiting rather than a language, and a name
 * nobody would give in earnest tells a volunteer something useful before they
 * have spent twenty minutes finding out.
 */
export async function GET() {
  try {
    const claims = await requireVolunteer();
    const c = container();

    const [waiting, mine] = await Promise.all([
      c.conversations.findWaiting(25),
      c.conversations.findActiveForVolunteer(asVolunteerId(claims.subject)),
    ]);

    const active = await Promise.all(mine.map((conversation) => activeEntry(c, conversation)));

    return ok({
      waiting: waiting.map((conversation) => ({
        id: conversation.id,
        name: conversation.seekerName,
        language: conversation.seekerLanguage,
        languageName: endonym(conversation.seekerLanguage),
        waitingSince: conversation.startedAt.toISOString(),
      })),
      active,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function activeEntry(c: Container, conversation: Conversation) {
  const preview = await lastMessagePreview(c, conversation);
  return {
    id: conversation.id,
    name: conversation.seekerName,
    language: conversation.seekerLanguage,
    languageName: endonym(conversation.seekerLanguage),
    matchedAt: conversation.matchedAt?.toISOString() ?? null,
    lastMessage: preview,
    // A volunteer's own rehearsal sits in this list beside real people —
    // `findActiveForVolunteer` does not filter it out, and nothing on the
    // row said which was which. Deciding here rather than in the browser
    // keeps `practiceScenario`, which names the scenario, on the server.
    practice: isPractice(conversation),
  };
}

/**
 * A one-line preview of the last thing said, in the volunteer's own
 * language — same rendering the rest of the app already shows them,
 * truncated for a dashboard row rather than a transcript.
 *
 * "You: " when the volunteer sent it last, so a reply-in-progress doesn't
 * read as something the seeker just said.
 */
async function lastMessagePreview(
  c: Container,
  conversation: Conversation,
): Promise<string | null> {
  const message = await c.messages.mostRecentFor(conversation.id);
  if (!message) return null;

  const text = renderingFor(message, conversation.volunteerLanguage ?? "en").text.trim();
  const truncated =
    text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH).trimEnd()}…` : text;

  return message.authorRole === "volunteer" ? `You: ${truncated}` : truncated;
}
