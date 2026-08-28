import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { base32Decode, base32Encode } from "./base32.js";

/**
 * Time-based one-time passwords, RFC 6238.
 *
 * Implemented here rather than taken from a package. The specification is
 * short and completely pinned down, and — decisively — it ships published test
 * vectors, so this can be *proved* correct rather than trusted. That is a
 * better position than an unaudited dependency sitting in the admin
 * authentication path. See totp.test.ts, which runs the RFC's own vectors.
 *
 * SHA-1 is not a mistake: RFC 6238 specifies it, and every authenticator app
 * assumes it. Its weaknesses are collision weaknesses, which do not apply to
 * HMAC — and being interoperable with the app an admin already has installed
 * matters more here than an academic upgrade nothing would accept.
 */
const DIGITS = 6;
const PERIOD_SECONDS = 30;

/** 160 bits, matching the SHA-1 block the RFC assumes. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The code for a given moment. Exported so tests can pin the clock. */
export function totpCodeAt(secret: string, atMs: number): string {
  const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  return hotp(base32Decode(secret), counter);
}

/**
 * Checks a code, allowing one step either side.
 *
 * The window exists because phone clocks drift and because a code typed at
 * :29 arrives at :31. One step each way is the usual compromise: it triples
 * the guessing surface from one in a million to three, which is still far
 * beyond what the rate limiter permits, and it removes almost all of the
 * "correct code rejected" reports that otherwise drive people to disable MFA.
 */
export function verifyTotp(
  secret: string,
  code: string,
  options: { atMs?: number; windowSteps?: number } = {},
): boolean {
  const supplied = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(supplied)) return false;

  const atMs = options.atMs ?? Date.now();
  const window = options.windowSteps ?? 1;
  const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  const key = base32Decode(secret);

  let matched = false;
  for (let offset = -window; offset <= window; offset++) {
    // No early exit: comparing every candidate keeps the work constant
    // regardless of which one matches.
    if (constantTimeEquals(hotp(key, counter + offset), supplied)) matched = true;
  }
  return matched;
}

/** The `otpauth://` URI an authenticator app reads from a QR code. */
export function totpProvisioningUri(
  secret: string,
  account: string,
  issuer = "Nexus",
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** RFC 4226 HOTP — the counter-based primitive TOTP is built on. */
function hotp(key: Uint8Array, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", key).update(buffer).digest();

  // Dynamic truncation: the low nibble of the last byte selects the offset.
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
