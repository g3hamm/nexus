import type { NextRequest } from "next/server";
import { z } from "zod";
import { generateRecoveryCodes, openSecret, verifyTotp } from "@nexus/auth";
import { NexusError, asAdminId } from "@nexus/core";
import { container } from "@/server/container";
import { env } from "@/server/env";
import { errorResponse, ok } from "@/server/http";
import { requireAdmin } from "@/server/session";

export const runtime = "nodejs";

const bodySchema = z.object({ code: z.string().min(6).max(10) });

/**
 * Confirms enrolment with a real code and turns MFA on.
 *
 * Requiring a working code before enabling is the whole reason enrolment and
 * enabling are separate: it proves the app is actually set up before the
 * account starts depending on it.
 *
 * Returns the recovery codes once. They are never retrievable again — only
 * their hashes are stored.
 */
export async function POST(request: NextRequest) {
  try {
    const claims = await requireAdmin();
    const adminId = asAdminId(claims.subject);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw NexusError.validation("A six-digit code is required");

    const c = container();
    const mfa = await c.admins.mfaFor(adminId);
    if (!mfa?.sealedSecret) {
      throw NexusError.conflict("Start by scanning the QR code.");
    }
    if (mfa.enabledAt) {
      throw NexusError.conflict("Two-factor authentication is already on.");
    }

    const secret = openSecret(mfa.sealedSecret, env().NEXUS_SESSION_SECRET);
    if (!secret || !verifyTotp(secret, parsed.data.code)) {
      throw NexusError.unauthorized(
        "That code is not correct. Check your phone's clock is accurate.",
      );
    }

    const recovery = generateRecoveryCodes(env().NEXUS_SESSION_SECRET);
    await c.admins.completeMfaEnrolment(adminId, recovery.hashes);

    await c.audit.record({
      action: "auth.login",
      actorRole: "admin",
      actorId: adminId,
      conversationId: null,
      detail: { mfaEnabled: true },
    });

    return ok({ enabled: true, recoveryCodes: recovery.plaintext });
  } catch (error) {
    return errorResponse(error);
  }
}
