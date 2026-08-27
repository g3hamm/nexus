import { randomBytes } from "node:crypto";
import type { LanguageCode, SeekerId } from "@nexus/core";
import { asSeekerId } from "@nexus/core";
import type { SessionClaims, SessionSigner } from "./session.js";

/** Long enough that handles never collide, short enough to read in a log. */
const HANDLE_BYTES = 16;

/**
 * A seeker's identity for the length of one visit.
 *
 * Generated fresh, never written to a users table, never linked to a previous
 * visit. Someone returning next week is a new seeker as far as Nexus can tell,
 * and that is the intended behaviour rather than a limitation: a durable
 * record that a particular person keeps asking about Jesus is precisely the
 * artefact that gets people arrested in some of the countries this serves.
 */
export function newSeekerId(): SeekerId {
  return asSeekerId(`skr_${randomBytes(HANDLE_BYTES).toString("base64url")}`);
}

/** Seekers stay signed in long enough to finish a conversation, not longer. */
export const SEEKER_SESSION_TTL_SECONDS = 12 * 60 * 60;
export const VOLUNTEER_SESSION_TTL_SECONDS = 8 * 60 * 60;

export async function issueSeekerSession(
  signer: SessionSigner,
  language: LanguageCode,
): Promise<{ seekerId: SeekerId; token: string }> {
  const seekerId = newSeekerId();
  const token = await signer.sign(
    {
      subject: seekerId,
      role: "seeker",
      // Never a real name. Volunteers see "Guest", which is all they need.
      displayName: "Guest",
      language,
    },
    SEEKER_SESSION_TTL_SECONDS,
  );
  return { seekerId, token };
}

export function isSeeker(claims: SessionClaims | null): boolean {
  return claims?.role === "seeker";
}

export function isVolunteer(claims: SessionClaims | null): boolean {
  return claims?.role === "volunteer";
}

export function isAdmin(claims: SessionClaims | null): boolean {
  return claims?.role === "admin";
}
