import { SignJWT, jwtVerify } from "jose";
import type { ParticipantRole } from "@nexus/core";
import { NexusError } from "@nexus/core";

/**
 * Signed session tokens for every kind of participant.
 *
 * Seekers get one too, which is the point: it carries a random handle and a
 * language and nothing else, so a seeker can reload the page and rejoin their
 * conversation without Nexus ever creating an account for them.
 */

export interface SessionClaims {
  /** Volunteer id, admin id, or a seeker's random per-visit handle. */
  readonly subject: string;
  readonly role: ParticipantRole;
  readonly displayName: string;
  /** Present for seekers, so the UI can render in their language on reload. */
  readonly language?: string;
}

export const SESSION_COOKIE = "nexus_session";
export const SEEKER_COOKIE = "nexus_seeker";

const ISSUER = "nexus";
const AUDIENCE = "nexus-app";

export class SessionSigner {
  readonly #secret: Uint8Array;

  constructor(secret: string) {
    if (secret.length < 32) {
      throw new NexusError(
        "crypto_failure",
        "NEXUS_SESSION_SECRET must be at least 32 characters. " +
          "Generate one with: openssl rand -base64 32",
      );
    }
    this.#secret = new TextEncoder().encode(secret);
  }

  async sign(claims: SessionClaims, ttlSeconds: number): Promise<string> {
    return new SignJWT({
      role: claims.role,
      name: claims.displayName,
      ...(claims.language ? { lang: claims.language } : {}),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.subject)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
      .sign(this.#secret);
  }

  /** Returns null for anything invalid — expired, tampered, or wrong issuer. */
  async verify(token: string | undefined): Promise<SessionClaims | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.#secret, {
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (!payload.sub || typeof payload.role !== "string") return null;

      return {
        subject: payload.sub,
        role: payload.role as ParticipantRole,
        displayName: typeof payload.name === "string" ? payload.name : "",
        ...(typeof payload.lang === "string" ? { language: payload.lang } : {}),
      };
    } catch {
      return null;
    }
  }
}

/** Cookie attributes. Same everywhere, so no surface can weaken them locally. */
export function sessionCookieOptions(isProduction: boolean, maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // Script must never be able to read a session token.
    secure: isProduction,
    // "lax" still sends the cookie on a top-level navigation, which is how a
    // seeker arrives from a shared link, while blocking cross-site POSTs.
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
