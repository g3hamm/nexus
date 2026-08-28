import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  VOLUNTEER_SESSION_TTL_SECONDS,
  findRecoveryCode,
  openSecret,
  verifyPassword,
  verifyTotp,
} from "@nexus/auth";
import type { AdminId } from "@nexus/core";
import { NexusError, RATE_LIMITS } from "@nexus/core";
import { container, type Container } from "@/server/container";
import { env } from "@/server/env";
import { errorResponse, ok } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { setStaffCookie } from "@/server/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  /** A six-digit TOTP code, or a recovery code. Only when MFA is on. */
  code: z.string().min(1).max(64).optional(),
});

/**
 * A real scrypt hash of a random string, so a login for an address with no
 * admin account costs the same as a wrong password. Admin email addresses are
 * a particularly valuable list to be able to enumerate.
 */
const DUMMY_HASH =
  "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, RATE_LIMITS.login);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw NexusError.validation("Email and password are required");

    const c = container();
    const { email, password } = parsed.data;

    const storedHash = await c.admins.passwordHashFor(email);
    const admin = await c.admins.findByEmail(email);
    const valid = await verifyPassword(password, storedHash ?? DUMMY_HASH);

    if (!valid || !admin) {
      await c.audit.record({
        action: "auth.failed",
        actorRole: "admin",
        actorId: null,
        conversationId: null,
        detail: { email },
      });
      throw NexusError.unauthorized("Email or password is incorrect");
    }

    /**
     * Second factor.
     *
     * The password is re-checked on the second step rather than issuing a
     * half-authenticated token between them. A partial session is a thing
     * that can be stolen, replayed, or forgotten about; re-submitting the
     * password costs one more scrypt and leaves nothing lying around.
     */
    const mfa = await c.admins.mfaFor(admin.id);
    if (mfa?.enabledAt && mfa.sealedSecret) {
      if (!parsed.data.code) {
        // Not an error. The form asks for a code and comes back.
        return ok({ mfaRequired: true }, 200);
      }

      const secret = openSecret(mfa.sealedSecret, env().NEXUS_SESSION_SECRET);
      if (!secret) {
        throw new NexusError(
          "crypto_failure",
          "Your second factor cannot be read, which usually means " +
            "NEXUS_SESSION_SECRET changed. An administrator can reset it with " +
            "pnpm reset:password.",
        );
      }

      const accepted = await verifySecondFactor(
        c,
        admin.id,
        secret,
        mfa.recoveryCodeHashes,
        parsed.data.code,
      );

      if (!accepted) {
        await c.audit.record({
          action: "auth.failed",
          actorRole: "admin",
          actorId: admin.id,
          conversationId: null,
          detail: { reason: "second factor" },
        });
        throw NexusError.unauthorized("That code is not correct.");
      }
    }

    const token = await c.sessions.sign(
      { subject: admin.id, role: "admin", displayName: admin.displayName },
      VOLUNTEER_SESSION_TTL_SECONDS,
    );
    await setStaffCookie(token, VOLUNTEER_SESSION_TTL_SECONDS);

    await c.audit.record({
      action: "auth.login",
      actorRole: "admin",
      actorId: admin.id,
      conversationId: null,
      detail: {},
    });

    return ok({ id: admin.id, displayName: admin.displayName, mfaRequired: false });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Accepts either a TOTP code or a recovery code.
 *
 * A recovery code is consumed the moment it works — one that still functions
 * afterwards is not a recovery code. Consuming it before the session is
 * issued means a crash between the two costs the admin a code rather than
 * leaving a used one live.
 */
async function verifySecondFactor(
  c: Container,
  adminId: AdminId,
  secret: string,
  recoveryCodeHashes: readonly string[],
  supplied: string,
): Promise<boolean> {
  if (verifyTotp(secret, supplied)) return true;

  const index = findRecoveryCode(
    supplied,
    recoveryCodeHashes,
    env().NEXUS_SESSION_SECRET,
  );
  if (index === null) return false;

  await c.admins.setRecoveryCodeHashes(
    adminId,
    recoveryCodeHashes.filter((_, i) => i !== index),
  );
  await c.audit.record({
    action: "auth.login",
    actorRole: "admin",
    actorId: adminId,
    conversationId: null,
    detail: {
      usedRecoveryCode: true,
      remaining: recoveryCodeHashes.length - 1,
    },
  });
  return true;
}
