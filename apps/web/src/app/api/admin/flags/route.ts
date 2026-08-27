import { container } from "@/server/container";
import { AdminService } from "@/server/admin-service";
import { errorResponse, ok } from "@/server/http";
import { requireAdmin } from "@/server/session";

export const runtime = "nodejs";

/** The review queue. Rationales are included — an admin is entitled to them. */
export async function GET() {
  try {
    await requireAdmin();
    const service = new AdminService(container());

    const [open, resolved] = await Promise.all([
      service.openFlags(50),
      service.resolvedFlags(20),
    ]);

    const shape = (flag: Awaited<ReturnType<typeof service.openFlags>>[number]) => ({
      id: flag.id,
      conversationId: flag.conversationId,
      category: flag.verdict.category,
      severity: flag.verdict.severity,
      subject: flag.verdict.subject,
      rationale: flag.verdict.rationale,
      recommended: flag.verdict.action,
      confidence: flag.verdict.confidence,
      evidenceCount: flag.verdict.evidenceMessageIds.length,
      status: flag.status,
      raisedAt: flag.raisedAt.toISOString(),
      reviewedAt: flag.reviewedAt?.toISOString() ?? null,
      reviewNote: flag.reviewNote,
    });

    return ok({ open: open.map(shape), resolved: resolved.map(shape) });
  } catch (error) {
    return errorResponse(error);
  }
}
