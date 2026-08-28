import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encrypts small server-side secrets at rest — currently TOTP seeds.
 *
 * A leaked database should not hand over password hashes *and* the second
 * factor that is supposed to survive them. Storing TOTP seeds in the clear is
 * common and defeats most of the point of having them.
 *
 * Keyed off `NEXUS_SESSION_SECRET` through HKDF with a distinct info string,
 * so this key and the session-signing key are unrelated even though they come
 * from the same configured value. Deliberately not the conversation KMS: these
 * are not conversation data, they have no per-conversation key, and an admin
 * must be able to sign in without a KMS round trip.
 */
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function deriveKey(secret: string, info: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.alloc(0), info, 32),
  );
}

export function sealSecret(
  plaintext: string,
  secret: string,
  info = "nexus:totp",
): string {
  const key = deriveKey(secret, info);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  // iv.tag.ciphertext, so the stored value is one self-describing string.
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/** Returns null rather than throwing — a rotated secret should not 500 a login. */
export function openSecret(
  sealed: string,
  secret: string,
  info = "nexus:totp",
): string | null {
  const parts = sealed.split(".");
  if (parts.length !== 3) return null;

  const [iv, tag, ciphertext] = parts as [string, string, string];
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      deriveKey(secret, info),
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
