import type { ConversationId } from "../domain/ids.js";

/**
 * Envelope encryption for conversation content.
 *
 * The shape is deliberate. Each conversation gets its own data key (DEK).
 * The DEK is never stored in the clear — it is wrapped by a master key that
 * lives in a KMS, and only the wrapped form sits next to the ciphertext.
 * Reading a conversation therefore costs an unwrap, and revoking access is
 * a KMS policy change rather than a re-encryption of the whole table.
 *
 * What this protects against: a leaked connection string, a stolen backup, a
 * curious employee at the database provider, a `SELECT *` from a compromised
 * read replica.
 *
 * What it does not protect against: compromise of the running application,
 * which necessarily holds unwrapped keys to do translation and moderation at
 * all. Stating that plainly is more useful than implying otherwise.
 */

/** An encryption context, bound into the ciphertext as additional authenticated data. */
export interface EncryptionContext {
  readonly conversationId: ConversationId;
  /** Bumped if the key hierarchy is ever rotated wholesale. */
  readonly purpose:
    | "message"
    | "seeker_metadata"
    | "flag_evidence"
    | "enablement_full"
    | "enablement_verses";
}

export interface CipherText {
  /** base64 */
  readonly ciphertext: string;
  /** base64 initialisation vector, unique per encryption. */
  readonly iv: string;
  /** base64 GCM authentication tag. */
  readonly authTag: string;
  /** e.g. "AES-256-GCM". Recorded so the format can evolve. */
  readonly algorithm: string;
  /** Identifies the master key that wrapped the DEK, for rotation. */
  readonly keyId: string;
  readonly version: number;
}

/** A per-conversation data key, wrapped by the master key. */
export interface WrappedDataKey {
  /** base64 of the wrapped DEK. Safe to store beside the ciphertext. */
  readonly wrapped: string;
  readonly keyId: string;
}

/**
 * Wraps and unwraps data keys. The master key never leaves this boundary —
 * with a real KMS it never leaves the KMS at all.
 */
export interface KeyManagement {
  readonly name: string;
  readonly keyId: string;
  generateDataKey(context: EncryptionContext): Promise<{
    readonly plaintextKey: Uint8Array;
    readonly wrapped: WrappedDataKey;
  }>;
  unwrapDataKey(wrapped: WrappedDataKey, context: EncryptionContext): Promise<Uint8Array>;
}

/**
 * What repositories actually call. Hides DEK lifecycle entirely, so no
 * feature code ever touches key material.
 */
export interface ConversationCrypto {
  /** Called once when a conversation is created. */
  createDataKey(conversationId: ConversationId): Promise<WrappedDataKey>;
  encrypt(
    plaintext: string,
    key: WrappedDataKey,
    context: EncryptionContext,
  ): Promise<CipherText>;
  decrypt(
    ciphertext: CipherText,
    key: WrappedDataKey,
    context: EncryptionContext,
  ): Promise<string>;
}
