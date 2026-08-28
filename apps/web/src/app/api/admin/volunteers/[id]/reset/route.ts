import { randomBytes } from "node:crypto";
import { hashRecoveryCode } from "@nexus/auth";
import { NexusError, asAdminId, asVolunteerId } from "@nexus/core";
import { container } from "@/server/container";
import { env } from "@/server/env";
import { errorResponse, ok } from "@/server/http";
import { requireAdmin } from "@/server/session";

export const runtime = "nodejs";

/** Long enough not to be guessable, short enough to read down a phone line. */
const RESET_TTL_HOURS = 24;

/**
 * Issues a one-time password reset code for a volunteer.
 *
 * Nexus has no email provider, so nothing is sent. The administrator is shown
 * the code once and passes it on however they already talk to that person.
 * For a small vetted volunteer base that is workable — and a code handed over
 * in a conversation you were already having is arguably harder to intercept
 * than a link sitting in an inbox.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireAdmin();
    const { id } = await context.params;

    const c = container();
    const volunteerId = asVolunteerId(id);
    const volunteer = await c.volunteers.findById(volunteerId);
    if (!volunteer) throw NexusError.notFound("Volunteer", id);

    const code = randomBytes(9)
      .toString("base64url")
      .slice(0, 12)
      .replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3")
      .toLowerCase();

    const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000);
    await c.volunteers.issuePasswordReset(
      volunteerId,
      // Same hashing as recovery codes, for the same reason: this is a
      // high-entropy value, so there is nothing for a slow hash to buy.
      hashRecoveryCode(code, env().NEXUS_SESSION_SECRET),
      expiresAt,
    );

    await c.audit.record({
      action: "volunteer.approved",
      actorRole: "admin",
      actorId: asAdminId(claims.subject),
      conversationId: null,
      detail: { volunteerId, passwordResetIssued: true },
    });

    return ok({
      code,
      email: volunteer.email,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
