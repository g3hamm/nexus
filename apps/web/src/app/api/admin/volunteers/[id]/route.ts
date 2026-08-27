import type { NextRequest } from "next/server";
import { z } from "zod";
import { NexusError, asAdminId, asVolunteerId } from "@nexus/core";
import { container } from "@/server/container";
import { AdminService } from "@/server/admin-service";
import { errorResponse, ok } from "@/server/http";
import { requireAdmin } from "@/server/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  approved: z.boolean().optional(),
  suspended: z.boolean().optional(),
});

/** Approve, un-approve, suspend, or reinstate a volunteer. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireAdmin();
    const { id } = await context.params;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (
      !parsed.success ||
      (parsed.data.approved === undefined && parsed.data.suspended === undefined)
    ) {
      throw NexusError.validation("Set either 'approved' or 'suspended'");
    }

    const service = new AdminService(container());
    const volunteerId = asVolunteerId(id);
    const adminId = asAdminId(claims.subject);

    if (parsed.data.approved !== undefined) {
      await service.setVolunteerApproved(volunteerId, adminId, parsed.data.approved);
    }
    if (parsed.data.suspended !== undefined) {
      await service.setVolunteerSuspended(volunteerId, adminId, parsed.data.suspended);
    }

    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
