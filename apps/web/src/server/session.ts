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

export async function requireVolunteer(): Promise<SessionClaims> {
  const claims = await staffSession();
  if (!claims) throw NexusError.unauthorized("Sign in to continue");
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
