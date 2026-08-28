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
    const { wrapped } = await this.#kms.generateDataKey(
      keyWrappingContext(conversationId),
    );
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

  /**
   * Unwraps the conversation's data key.
   *
   * Always under the *key-wrapping* context, never the caller's — those are
   * two different bindings and conflating them was a real bug. `purpose`
   * exists to bind a ciphertext to what it is (a message, a flag rationale)
   * so one cannot be substituted for another; it says nothing about the key.
   * Unwrapping under the caller's purpose meant a DEK wrapped for "message"
   * could not be unwrapped to encrypt a flag rationale, so every flag the
   * judge raised failed to persist — silently, because moderation failures
   * are deliberately swallowed rather than shown to the people talking.
   *
   * The payload binding is unaffected: `seal` and `open` still use the
   * caller's full context as additional authenticated data, which is where
   * that property actually lives.
   */
  async #unwrap(key: WrappedDataKey, context: EncryptionContext): Promise<Uint8Array> {
    const wrappingContext = keyWrappingContext(context.conversationId);
    const cacheKey = `${key.keyId}:${key.wrapped}`;
    const cached = this.#cache.get(cacheKey);
    if (cached) return cached;

    const dek = await this.#kms.unwrapDataKey(key, wrappingContext);
    this.#cache.set(cacheKey, dek);
    return dek;
  }
}

/**
 * The context a conversation's data key is wrapped under.
 *
 * `purpose: "message"` is not describing the payload here — it is the value
 * this has always been wrapped with, and changing it would make every data
 * key already in a database unopenable. Deliberately fixed, and deliberately
 * separate from the payload context.
 */
function keyWrappingContext(conversationId: ConversationId): EncryptionContext {
  return { conversationId, purpose: "message" };
}
