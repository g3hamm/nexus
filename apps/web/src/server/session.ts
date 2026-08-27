import "server-only";

import { cookies } from "next/headers";
import type { SessionClaims } from "@nexus/auth";
import { SEEKER_COOKIE, SESSION_COOKIE, sessionCookieOptions } from "@nexus/auth";
import { NexusError } from "@nexus/core";
import { container } from "./container";
import { isProduction } from "./env";

/** The seeker session, if this browser has one. */
export async function seekerSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const claims = await container().sessions.verify(jar.get(SEEKER_COOKIE)?.value);
  return claims?.role === "seeker" ? claims : null;
}

/** The volunteer or admin session, if this browser has one. */
export async function staffSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const claims = await container().sessions.verify(jar.get(SESSION_COOKIE)?.value);
  return claims?.role === "volunteer" || claims?.role === "admin" ? claims : null;
}

export async function requireAdmin(): Promise<SessionClaims> {
  const claims = await staffSession();
  // An admin can read every transcript on the platform, so this check is the
  // one that matters most in the app. Volunteer sessions do not pass it.
  if (claims?.role !== "admin") {
    throw NexusError.forbidden("Administrator access required");
  }
  return claims;
}

export async function requireVolunteer(): Promise<SessionClaims> {
  const claims = await staffSession();
  if (!claims) throw NexusError.unauthorized("Sign in to continue");

  // Specifically a volunteer, not merely "staff". An admin session carries an
  // admin id, and the volunteer routes look up conversations by that subject —
  // so letting an admin session through here does not grant anything useful,
  // it just produces an empty queue and a confusing "volunteer not found".
  // One browser holds one role at a time; sign in again to switch.
  if (claims.role !== "volunteer") {
    throw NexusError.forbidden(
      "This is the volunteer area. Sign in at /volunteer/login to use it.",
    );
  }
  return claims;
}

export async function setSeekerCookie(token: string, maxAge: number): Promise<void> {
  const jar = await cookies();
  jar.set(SEEKER_COOKIE, token, sessionCookieOptions(isProduction(), maxAge));
}

export async function setStaffCookie(token: string, maxAge: number): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(isProduction(), maxAge));
}

export async function clearStaffCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
