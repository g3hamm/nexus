import { z } from "zod";
import { NexusError, asConversationId, asVolunteerId } from "@nexus/core";
import { container } from "@/server/container";
import { errorResponse, ok } from "@/server/http";
import { PracticeService } from "@/server/practice-service";
import { requireVolunteer } from "@/server/session";

export const runtime = "nodejs";
/** The coach reads the whole transcript and thinks about it. Not a quick call. */
export const maxDuration = 120;

/**
 * The Academy module the volunteer started this exercise from, if any.
 *
 * Optional, and unverifiable here on purpose — the service checks the module
 * against the scenario before it steers anything. The worst a wrong id could
 * do is anchor somebody's own private feedback to the wrong reading.
 */
const bodySchema = z.object({ academyModule: z.string().max(64).optional() });

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
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireVolunteer();
    const { id } = await context.params;

    const c = container();
    const volunteer = await c.volunteers.findById(asVolunteerId(claims.subject));
    if (!volunteer) throw NexusError.notFound("Volunteer", claims.subject);

    const body = bodySchema.safeParse(await request.json().catch(() => ({})));

    const debrief = await new PracticeService(c).debrief(
      asConversationId(id),
      volunteer,
      body.success ? body.data.academyModule : undefined,
    );

    return ok({ debrief });
  } catch (error) {
    return errorResponse(error);
  }
}
