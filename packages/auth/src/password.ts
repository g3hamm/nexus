import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { NexusError } from "@nexus/core";

/**
 * `promisify` collapses scrypt's overloads and drops the options parameter,
 * so the promisified form is given its own signature.
 */
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt is memory-hard and built in, which means no native module to compile
 * and nothing to break on a Vercel build. Volunteers are a small, vetted,
 * invite-only population, so this is the right amount of machinery — see
 * docs/adr/0005-authentication.md for when to graduate to a managed identity
 * provider instead.
 */
const SCRYPT_N = 32768; // CPU/memory cost
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
// scrypt needs roughly 128 * N * r bytes; Node's default maxmem is below that.
const MAX_MEM = 128 * SCRYPT_N * SCRYPT_R * 2;

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEM,
  });

  // Parameters travel with the hash so they can be raised later without
  // invalidating every existing password.
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const expected = Buffer.from(hashRaw, "base64");

  let derived: Buffer;
  try {
    derived = await scryptAsync(
      password,
      Buffer.from(saltRaw, "base64"),
      expected.length,
      {
        N: n,
        r,
        p,
        maxmem: 128 * n * r * 2,
      },
    );
  } catch {
    return false;
  }

  if (derived.length !== expected.length) return false;
  // Constant time: a length-varying or short-circuiting compare leaks the hash.
  return timingSafeEqual(derived, expected);
}

/**
 * Deliberately minimal.
 *
 * Length beats composition rules — a 12-character passphrase is stronger than
 * "P@ss1!" and far likelier to be remembered rather than written down. The
 * upper bound exists so a very long input cannot be used to burn CPU.
 */
export function assertPasswordPolicy(password: string): void {
  if (password.length < 12) {
    throw NexusError.validation("Password must be at least 12 characters");
  }
  if (password.length > 200) {
    throw NexusError.validation("Password must be at most 200 characters");
  }
}
