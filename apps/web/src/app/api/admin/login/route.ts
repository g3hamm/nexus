import type { NextRequest } from "next/server";
import { z } from "zod";
import { VOLUNTEER_SESSION_TTL_SECONDS, verifyPassword } from "@nexus/auth";
import { NexusError, RATE_LIMITS } from "@nexus/core";
import { container } from "@/server/container";
import { errorResponse, ok } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { setStaffCookie } from "@/server/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
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

    return ok({ id: admin.id, displayName: admin.displayName });
  } catch (error) {
    return errorResponse(error);
  }
}
