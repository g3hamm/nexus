import type { NextRequest } from "next/server";
import { z } from "zod";
import { findRecoveryCode, openSecret, verifyTotp } from "@nexus/auth";
import { NexusError, asAdminId } from "@nexus/core";
import { container } from "@/server/container";
import { env } from "@/server/env";
import { errorResponse, ok } from "@/server/http";
import { requireAdmin } from "@/server/session";

export const runtime = "nodejs";

/** Current second-factor state. Never returns the secret itself. */
export async function GET() {
  try {
    const claims = await requireAdmin();
    const mfa = await container().admins.mfaFor(asAdminId(claims.subject));

    return ok({
      enrolled: Boolean(mfa?.sealedSecret),
      enabled: Boolean(mfa?.enabledAt),
      recoveryCodesRemaining: mfa?.recoveryCodeHashes.length ?? 0,
      enabledAt: mfa?.enabledAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

const disableSchema = z.object({ code: z.string().min(1).max(64) });

/**
 * Turns MFA off, and only with a working code.
 *
 * An already-signed-in session is not enough. A borrowed laptop is exactly the
 * situation the second factor exists for, and letting a live session remove it
 * would make it decorative.
 */
export async function DELETE(request: NextRequest) {
  try {
    const claims = await requireAdmin();
    const adminId = asAdminId(claims.subject);

    const parsed = disableSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw NexusError.validation("A current code is required");

    const c = container();
    const mfa = await c.admins.mfaFor(adminId);
    if (!mfa?.enabledAt || !mfa.sealedSecret) {
      throw NexusError.conflict("Two-factor authentication is not on.");
    }

    const secret = openSecret(mfa.sealedSecret, env().NEXUS_SESSION_SECRET);
    const accepted =
      (secret !== null && verifyTotp(secret, parsed.data.code)) ||
      findRecoveryCode(
        parsed.data.code,
        mfa.recoveryCodeHashes,
        env().NEXUS_SESSION_SECRET,
      ) !== null;

    if (!accepted) throw NexusError.unauthorized("That code is not correct.");

    await c.admins.disableMfa(adminId);
    await c.audit.record({
      action: "auth.login",
      actorRole: "admin",
      actorId: adminId,
      conversationId: null,
      detail: { mfaDisabled: true },
    });

    return ok({ enabled: false });
  } catch (error) {
    return errorResponse(error);
  }
}
