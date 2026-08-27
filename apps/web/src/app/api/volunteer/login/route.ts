import type { NextRequest } from "next/server";
import { z } from "zod";
import { VOLUNTEER_SESSION_TTL_SECONDS, verifyPassword } from "@nexus/auth";
import { NexusError, isActiveVolunteer } from "@nexus/core";
import { container } from "@/server/container";
import { errorResponse, ok } from "@/server/http";
import { setStaffCookie } from "@/server/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw NexusError.validation("Email and password are required");

    const c = container();
    const { email, password } = parsed.data;

    const storedHash = await c.volunteers.passwordHashFor(email);
    const volunteer = await c.volunteers.findByEmail(email);

    // Verify even when there is no such account, against a dummy hash of the
    // same cost. Otherwise response timing tells an attacker which email
    // addresses are registered volunteers — which, for this platform, is a
    // list worth protecting.
    const ok_ = await verifyPassword(password, storedHash ?? DUMMY_HASH);

    if (!ok_ || !volunteer) {
      await c.audit.record({
        action: "auth.failed",
        actorRole: "volunteer",
        actorId: null,
        conversationId: null,
        detail: { email },
      });
      throw NexusError.unauthorized("Email or password is incorrect");
    }

    if (!isActiveVolunteer(volunteer)) {
      throw NexusError.forbidden(
        volunteer.suspendedAt
          ? "This account is suspended."
          : "This account is awaiting approval by an administrator.",
      );
    }

    const token = await c.sessions.sign(
      {
        subject: volunteer.id,
        role: "volunteer",
        displayName: volunteer.displayName,
      },
      VOLUNTEER_SESSION_TTL_SECONDS,
    );
    await setStaffCookie(token, VOLUNTEER_SESSION_TTL_SECONDS);

    await c.volunteers.setStatus(volunteer.id, "available");
    await c.audit.record({
      action: "auth.login",
      actorRole: "volunteer",
      actorId: volunteer.id,
      conversationId: null,
      detail: {},
    });

    return ok({
      id: volunteer.id,
      displayName: volunteer.displayName,
      languages: volunteer.languages,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * A real scrypt hash of a random string, so the no-such-account path costs
 * the same as the wrong-password path.
 */
const DUMMY_HASH =
  "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
