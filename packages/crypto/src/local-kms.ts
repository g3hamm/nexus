import type { EncryptionContext, KeyManagement, WrappedDataKey } from "@nexus/core";
import { NexusError } from "@nexus/core";
import { assertKeyLength, open, randomKey, seal } from "./aes.js";
import { contextToAad } from "./context.js";

/**
 * Development key management.
 *
 * The master key sits in an environment variable, which means anyone who can
 * read the environment can read every conversation. That is acceptable on a
 * laptop and unacceptable in production — `createKeyManagement` refuses to
 * hand this back when NODE_ENV is "production".
 */
export class LocalKeyManagement implements KeyManagement {
  readonly name = "local";
  readonly keyId: string;
  readonly #masterKey: Buffer;

  constructor(masterKey: Buffer, keyId = "local-dev") {
    assertKeyLength(masterKey, "master key");
    this.#masterKey = masterKey;
    this.keyId = keyId;
  }

  static fromBase64(value: string, keyId?: string): LocalKeyManagement {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length !== 32) {
      throw new NexusError(
        "crypto_failure",
        "NEXUS_MASTER_KEY must decode to 32 bytes. Generate one with: openssl rand -base64 32",
      );
    }
    return new LocalKeyManagement(decoded, keyId);
  }

  async generateDataKey(context: EncryptionContext): Promise<{
    plaintextKey: Uint8Array;
    wrapped: WrappedDataKey;
  }> {
    const dek = randomKey();
    const aad = contextToAad(context);
    const sealed = seal(dek.toString("base64"), this.#masterKey, aad);
    // iv.tag.ciphertext, so the wrapped blob is one self-describing string.
    const wrapped = [
      sealed.iv.toString("base64"),
      sealed.authTag.toString("base64"),
      sealed.ciphertext.toString("base64"),
    ].join(".");
    return {
      plaintextKey: dek,
      wrapped: { wrapped, keyId: this.keyId },
    };
  }

  async unwrapDataKey(
    wrapped: WrappedDataKey,
    context: EncryptionContext,
  ): Promise<Uint8Array> {
    const parts = wrapped.wrapped.split(".");
    if (parts.length !== 3) {
      throw new NexusError("crypto_failure", "Malformed wrapped data key");
    }
    const [iv, authTag, ciphertext] = parts as [string, string, string];
    const dekBase64 = open(
      {
        iv: Buffer.from(iv, "base64"),
        authTag: Buffer.from(authTag, "base64"),
        ciphertext: Buffer.from(ciphertext, "base64"),
      },
      this.#masterKey,
      contextToAad(context),
    );
    return Buffer.from(dekBase64, "base64");
  }
}
