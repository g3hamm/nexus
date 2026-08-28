/**
 * @nexus/auth — authentication for volunteers and admins, and anonymous
 * sessions for seekers.
 *
 * Kept small and vendor-free on purpose. Volunteers are a vetted, invite-only
 * population measured in hundreds, not a consumer signup funnel, and seekers
 * deliberately have no accounts at all — so the usual reasons to adopt a
 * managed identity provider mostly do not apply. See
 * docs/adr/0005-authentication.md for the swap path when they do.
 */
export { hashPassword, verifyPassword, assertPasswordPolicy } from "./password.js";
export {
  SessionSigner,
  sessionCookieOptions,
  SESSION_COOKIE,
  SEEKER_COOKIE,
  type SessionClaims,
} from "./session.js";
export {
  newSeekerId,
  issueSeekerSession,
  isSeeker,
  isVolunteer,
  isAdmin,
  SEEKER_SESSION_TTL_SECONDS,
  VOLUNTEER_SESSION_TTL_SECONDS,
} from "./seeker.js";
export {
  generateTotpSecret,
  totpCodeAt,
  totpProvisioningUri,
  verifyTotp,
} from "./totp.js";
export { base32Encode, base32Decode } from "./base32.js";
export { sealSecret, openSecret } from "./secret-box.js";
export {
  generateRecoveryCodes,
  hashRecoveryCode,
  findRecoveryCode,
  type RecoveryCodes,
} from "./recovery.js";
