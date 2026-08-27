import type {
  CipherText,
  ConversationCrypto,
  ConversationId,
  EncryptionContext,
  KeyManagement,
  WrappedDataKey,
} from "@nexus/core";
import { NexusError } from "@nexus/core";
import { ALGORITHM, open, seal } from "./aes.js";
import { contextToAad } from "./context.js";
import { DataKeyCache } from "./key-cache.js";

const FORMAT_VERSION = 1;

/**
 * Envelope encryption over a `KeyManagement` backend.
 *
 * This is the only thing repositories talk to. It never exposes key material,
 * and it refuses to decrypt a ciphertext whose format version it does not
 * recognise rather than guessing.
 */
export class EnvelopeCrypto implements ConversationCrypto {
  readonly #kms: KeyManagement;
  readonly #cache: DataKeyCache;

  constructor(kms: KeyManagement, cache: DataKeyCache = new DataKeyCache()) {
    this.#kms = kms;
    this.#cache = cache;
  }

  async createDataKey(conversationId: ConversationId): Promise<WrappedDataKey> {
    const { wrapped } = await this.#kms.generateDataKey({
      conversationId,
      purpose: "message",
    });
    return wrapped;
  }

  async encrypt(
    plaintext: string,
    key: WrappedDataKey,
    context: EncryptionContext,
  ): Promise<CipherText> {
    const dek = await this.#unwrap(key, context);
    const sealed = seal(plaintext, dek, contextToAad(context));
    return {
      ciphertext: sealed.ciphertext.toString("base64"),
      iv: sealed.iv.toString("base64"),
      authTag: sealed.authTag.toString("base64"),
      algorithm: ALGORITHM,
      keyId: key.keyId,
      version: FORMAT_VERSION,
    };
  }

  async decrypt(
    ciphertext: CipherText,
    key: WrappedDataKey,
    context: EncryptionContext,
  ): Promise<string> {
    if (ciphertext.version !== FORMAT_VERSION) {
      throw new NexusError(
        "crypto_failure",
        `Unsupported ciphertext version ${ciphertext.version}`,
      );
    }
    if (ciphertext.algorithm !== ALGORITHM) {
      throw new NexusError(
        "crypto_failure",
        `Unsupported algorithm ${ciphertext.algorithm}`,
      );
    }
    const dek = await this.#unwrap(key, context);
    return open(
      {
        ciphertext: Buffer.from(ciphertext.ciphertext, "base64"),
        iv: Buffer.from(ciphertext.iv, "base64"),
        authTag: Buffer.from(ciphertext.authTag, "base64"),
      },
      dek,
      contextToAad(context),
    );
  }

  async #unwrap(key: WrappedDataKey, context: EncryptionContext): Promise<Uint8Array> {
    // The context is part of the cache key: the same wrapped DEK under a
    // different purpose must not be served from one cache entry.
    const cacheKey = `${key.keyId}:${context.purpose}:${key.wrapped}`;
    const cached = this.#cache.get(cacheKey);
    if (cached) return cached;

    const dek = await this.#kms.unwrapDataKey(key, context);
    this.#cache.set(cacheKey, dek);
    return dek;
  }
}
