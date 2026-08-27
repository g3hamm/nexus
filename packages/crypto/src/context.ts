import type { EncryptionContext } from "@nexus/core";

/**
 * Serialises an encryption context for use as additional authenticated data.
 *
 * Binding the context into the ciphertext means a message row copied from one
 * conversation into another fails to decrypt rather than decrypting into the
 * wrong conversation. Key order is fixed because AAD is compared byte for byte.
 */
export function contextToAad(context: EncryptionContext): Buffer {
  const canonical = `conversationId=${context.conversationId}&purpose=${context.purpose}`;
  return Buffer.from(canonical, "utf8");
}

/** The same context in the shape AWS KMS expects. */
export function contextToKmsRecord(context: EncryptionContext): Record<string, string> {
  return {
    conversationId: String(context.conversationId),
    purpose: context.purpose,
  };
}
