import { NexusError, asConversationId, asVolunteerId } from "@nexus/core";
import { container } from "@/server/container";
import { errorResponse, ok } from "@/server/http";
import { PracticeService } from "@/server/practice-service";
import { requireVolunteer } from "@/server/session";

export const runtime = "nodejs";
/** The coach reads the whole transcript and thinks about it. Not a quick call. */
export const maxDuration = 120;

/**
 * End a practice session and get the debrief.
 *
 * The debrief is generated here and returned, never stored. It is read once
 * by one person; keeping a file of standing assessments of volunteers is a
 * different and far more sensitive thing than running a training exercise,
 * and it should be a ministry's deliberate decision rather than a side effect
 * of this feature.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireVolunteer();
    const { id } = await context.params;

    const c = container();
    const volunteer = await c.volunteers.findById(asVolunteerId(claims.subject));
    if (!volunteer) throw NexusError.notFound("Volunteer", claims.subject);

    const debrief = await new PracticeService(c).debrief(
      asConversationId(id),
      volunteer,
    );

    return ok({ debrief });
  } catch (error) {
    return errorResponse(error);
  }
}
