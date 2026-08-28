import type { NextRequest } from "next/server";
import { z } from "zod";
import { hashPassword, hashRecoveryCode } from "@nexus/auth";
import { NexusError, RATE_LIMITS } from "@nexus/core";
import { container } from "@/server/container";
import { env } from "@/server/env";
import { errorResponse, ok } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().min(1).max(64),
  password: z.string().min(12).max(200),
});

/**
 * Redeems a reset code an administrator issued.
 *
 * Rate limited under the sign-in rule: this accepts a secret and grants
 * account access, so it is a credential endpoint whatever it is called.
 */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, RATE_LIMITS.login);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw NexusError.validation(
        "An email, the code you were given, and a new password of at least " +
          "12 characters are all required.",
      );
    }

    const c = container();
    const pending = await c.volunteers.pendingResetFor(parsed.data.email);

    // One message for every failure — no reset, wrong code, expired. Saying
    // which would tell someone whether an address has a reset waiting.
    const wrong = () =>
      NexusError.unauthorized(
        "That code is not valid. Ask an administrator to issue a new one.",
      );

    if (!pending) throw wrong();
    if (pending.expiresAt.getTime() < Date.now()) throw wrong();

    const supplied = hashRecoveryCode(parsed.data.code, env().NEXUS_SESSION_SECRET);
    if (supplied !== pending.codeHash) throw wrong();

    await c.volunteers.completePasswordReset(
      pending.id,
      await hashPassword(parsed.data.password),
    );

    await c.audit.record({
      action: "auth.login",
      actorRole: "volunteer",
      actorId: pending.id,
      conversationId: null,
      detail: { passwordReset: true },
    });

    return ok({ reset: true });
  } catch (error) {
    return errorResponse(error);
  }
}
