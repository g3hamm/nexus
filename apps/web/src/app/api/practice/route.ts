import type { NextRequest } from "next/server";
import { z } from "zod";
import { NexusError, RATE_LIMITS, asVolunteerId } from "@nexus/core";
import { scenarioIds } from "@nexus/practice";
import { container } from "@/server/container";
import { errorResponse, ok } from "@/server/http";
import { PracticeService } from "@/server/practice-service";
import { enforceRateLimit } from "@/server/rate-limit";
import { requireVolunteer } from "@/server/session";

export const runtime = "nodejs";

const bodySchema = z.object({ scenarioId: z.string().min(1).max(64) });

/**
 * Start a practice session.
 *
 * Approval is required, same as taking a real conversation. Practice is
 * cheaper than a real seeker but it is not free — every turn is a model call
 * — and an unapproved applicant is somebody nobody has vetted yet.
 */
export async function POST(request: NextRequest) {
  try {
    const claims = await requireVolunteer();

    const c = container();
    const volunteer = await c.volunteers.findById(asVolunteerId(claims.subject));
    if (!volunteer) throw NexusError.notFound("Volunteer", claims.subject);
    if (volunteer.approvedAt === null || volunteer.suspendedAt !== null) {
      throw NexusError.forbidden("Your account is not approved for conversations yet");
    }

    // Keyed on the volunteer. A session is a dozen model calls, and a stuck
    // "Start" button should cost one conversation, not twenty.
    await enforceRateLimit(request, RATE_LIMITS.practiceStart, volunteer.id);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success || !scenarioIds().includes(parsed.data.scenarioId)) {
      throw NexusError.validation("Choose one of the practice scenarios");
    }

    const conversation = await new PracticeService(c).start(
      volunteer,
      parsed.data.scenarioId,
    );

    return ok({ conversationId: conversation.id }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
