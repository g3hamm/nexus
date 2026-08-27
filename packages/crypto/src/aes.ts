import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { NexusError } from "@nexus/core";

export const ALGORITHM = "AES-256-GCM";
const NODE_ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits, the size GCM is defined for
const KEY_BYTES = 32; // 256 bits
const TAG_BYTES = 16;

export interface SealedBytes {
  readonly ciphertext: Buffer;
  readonly iv: Buffer;
  readonly authTag: Buffer;
}

export function randomKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

export function assertKeyLength(key: Uint8Array, what: string): void {
  if (key.length !== KEY_BYTES) {
    throw new NexusError(
      "crypto_failure",
      `${what} must be ${KEY_BYTES} bytes, got ${key.length}`,
    );
  }
}

/** AES-256-GCM seal. A fresh IV every time — reusing one with GCM is fatal. */
export function seal(plaintext: string, key: Uint8Array, aad: Buffer): SealedBytes {
  assertKeyLength(key, "encryption key");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(NODE_ALGORITHM, key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function open(sealed: SealedBytes, key: Uint8Array, aad: Buffer): string {
  assertKeyLength(key, "decryption key");
  if (sealed.authTag.length !== TAG_BYTES) {
    throw new NexusError("crypto_failure", "Malformed authentication tag");
  }
  try {
    const decipher = createDecipheriv(NODE_ALGORITHM, key, sealed.iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(sealed.authTag);
    return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString(
      "utf8",
    );
  } catch (cause) {
    // A GCM tag mismatch means the ciphertext, the key, or the context is
    // wrong. Never leak which — that distinction is an oracle.
    throw new NexusError(
      "crypto_failure",
      "Decryption failed: ciphertext, key, or encryption context does not match",
      {},
      { cause },
    );
  }
}
