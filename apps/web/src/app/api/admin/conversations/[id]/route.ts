import { asAdminId, asConversationId, endonym } from "@nexus/core";
import { container } from "@/server/container";
import { AdminService } from "@/server/admin-service";
import { errorResponse, ok } from "@/server/http";
import { requireAdmin } from "@/server/session";

export const runtime = "nodejs";

/**
 * A full transcript, for review.
 *
 * Reading this writes `conversation.viewed` to the audit log before any
 * message is returned. That is not incidental — it is the thing that makes
 * admin access to seekers' conversations defensible.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireAdmin();
    const { id } = await context.params;

    const c = container();
    const conversationId = asConversationId(id);
    const service = new AdminService(c);

    const [conversation, transcript] = await Promise.all([
      c.conversations.findById(conversationId),
      service.transcriptFor(conversationId, asAdminId(claims.subject)),
    ]);

    return ok({
      conversation: conversation
        ? {
            id: conversation.id,
            status: conversation.status,
            seekerLanguage: conversation.seekerLanguage,
            seekerLanguageName: endonym(conversation.seekerLanguage),
            volunteerLanguage: conversation.volunteerLanguage,
            startedAt: conversation.startedAt.toISOString(),
            endedAt: conversation.endedAt?.toISOString() ?? null,
            retainUntil: conversation.retainUntil?.toISOString() ?? null,
          }
        : null,
      lines: transcript.lines,
      flags: transcript.flags.map((flag) => ({
        id: flag.id,
        category: flag.verdict.category,
        severity: flag.verdict.severity,
        subject: flag.verdict.subject,
        rationale: flag.verdict.rationale,
        recommended: flag.verdict.action,
        confidence: flag.verdict.confidence,
        evidenceMessageIds: flag.verdict.evidenceMessageIds,
        status: flag.status,
        raisedAt: flag.raisedAt.toISOString(),
        reviewNote: flag.reviewNote,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
