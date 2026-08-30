import { container } from "@/server/container";
import { EnablementCacheService } from "@/server/enablement-cache-service";
import { errorResponse, ok } from "@/server/http";
import { requireMatchedVolunteer, toWire } from "../shared";

export const runtime = "nodejs";
// This route's whole point is the expensive path — always regenerates.
export const maxDuration = 60;

/**
 * The "Update" button. The only thing that regenerates the full analysis
 * once it has ever run once for a conversation — see the plain GET on the
 * parent route, which prefers whatever is already cached.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const conversation = await requireMatchedVolunteer(id);

    const suggestions = await new EnablementCacheService(container()).getSuggestions(
      conversation.id,
      { forceRefresh: true },
    );

    return ok(toWire(suggestions));
  } catch (error) {
    return errorResponse(error);
  }
}
