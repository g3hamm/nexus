import { container } from "@/server/container";
import { EnablementCacheService } from "@/server/enablement-cache-service";
import { errorResponse, ok } from "@/server/http";
import { requireMatchedVolunteer, toWire } from "./shared";

export const runtime = "nodejs";
// The bootstrap path is retrieval plus a careful model call, comfortably
// longer than a chat turn. A cache hit is a single fast DB read — this
// covers the slow path, not the common one.
export const maxDuration = 60;

/**
 * Suggestions for the volunteer's sidebar.
 *
 * Volunteer-only, and only for a conversation they were actually matched
 * with. A seeker must never be able to fetch this — being shown the notes
 * someone is keeping about you mid-conversation would be a small betrayal of
 * what this is supposed to be.
 *
 * Prefers the cache. The first ever call for a conversation bootstraps it —
 * the one expensive path here — and every call after that, including one
 * from a volunteer who left and came back, reads what is already stored
 * instead of generating it again. Regenerating on request is what
 * `POST .../refresh` is for.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const conversation = await requireMatchedVolunteer(id);

    const suggestions = await new EnablementCacheService(container()).getSuggestions(
      conversation.id,
    );

    return ok(toWire(suggestions));
  } catch (error) {
    return errorResponse(error);
  }
}
