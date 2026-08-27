import type { NextRequest } from "next/server";
import { z } from "zod";
import { NexusError, asAdminId, asFlagId } from "@nexus/core";
import { container } from "@/server/container";
import { AdminService } from "@/server/admin-service";
import { errorResponse, ok } from "@/server/http";
import { requireAdmin } from "@/server/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  decision: z.enum(["upheld", "dismissed"]),
  // A decision without a reason is not reviewable by the next person.
  note: z.string().min(1).max(2000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireAdmin();
    const { id } = await context.params;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw NexusError.validation(
        "A decision and a note explaining it are both required.",
      );
    }

    await new AdminService(container()).resolveFlag(
      asFlagId(id),
      asAdminId(claims.subject),
      parsed.data.decision,
      parsed.data.note,
    );

    return ok({ resolved: true });
  } catch (error) {
    return errorResponse(error);
  }
}
