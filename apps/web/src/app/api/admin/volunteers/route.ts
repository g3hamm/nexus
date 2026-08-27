import { endonym } from "@nexus/core";
import { container } from "@/server/container";
import { AdminService } from "@/server/admin-service";
import { errorResponse, ok } from "@/server/http";
import { requireAdmin } from "@/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const volunteers = await new AdminService(container()).volunteers();

    return ok({
      volunteers: volunteers.map((v) => ({
        id: v.id,
        displayName: v.displayName,
        email: v.email,
        languages: v.languages,
        languageNames: v.languages.map(endonym),
        status: v.status,
        approved: v.approvedAt !== null,
        suspended: v.suspendedAt !== null,
        applicationNote: v.applicationNote,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
