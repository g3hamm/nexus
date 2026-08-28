import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Recovery codes, for the admin who loses their phone.
 *
 * Without these, enabling MFA is a way to lock yourself permanently out of
 * every transcript on the platform, and the only remedy is someone with
 * database credentials. That is not a reasonable position to put a small
 * ministry in.
 *
 * Hashed with HMAC-SHA256 rather than scrypt, and that is deliberate rather
 * than lazy: scrypt is slow because passwords are low-entropy and must be made
 * expensive to guess. These are 80 random bits. There is nothing to guess, so
 * the cost buys nothing — and hashing ten of them at scrypt cost would make
 * enabling MFA take a visible second for no gain.
 */
const CODE_COUNT = 10;
const CODE_BYTES = 10; // 80 bits

export interface RecoveryCodes {
  /** Shown to the admin exactly once. Never stored. */
  readonly plaintext: readonly string[];
  /** Stored. Useless for signing in. */
  readonly hashes: readonly string[];
}

export function generateRecoveryCodes(secret: string): RecoveryCodes {
  const plaintext = Array.from({ length: CODE_COUNT }, () =>
    // Grouped, because people transcribe these by hand off a screen.
    randomBytes(CODE_BYTES)
      .toString("base64url")
      .slice(0, 12)
      .replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3")
      .toLowerCase(),
  );

  return { plaintext, hashes: plaintext.map((code) => hashRecoveryCode(code, secret)) };
}

export function hashRecoveryCode(code: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`recovery:${normaliseCode(code)}`)
    .digest("base64url");
}

/**
 * Finds which stored hash a code matches, or null.
 *
 * Every candidate is compared, so the work does not depend on which code was
 * used or whether one matched at all. The caller is expected to delete the
 * matched hash — a recovery code that still works after it has been used is
 * not a recovery code.
 */
export function findRecoveryCode(
  code: string,
  hashes: readonly string[],
  secret: string,
): number | null {
  const candidate = Buffer.from(hashRecoveryCode(code, secret));
  let found: number | null = null;

  hashes.forEach((stored, index) => {
    const storedBuffer = Buffer.from(stored);
    if (storedBuffer.length !== candidate.length) return;
    if (timingSafeEqual(storedBuffer, candidate)) found = index;
  });

  return found;
}

/** People type these back with the dashes, without, and in either case. */
function normaliseCode(code: string): string {
  return code.toLowerCase().replace(/[\s-]/g, "");
}
