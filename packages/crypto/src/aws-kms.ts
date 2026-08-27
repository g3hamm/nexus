import type { EncryptionContext, KeyManagement, WrappedDataKey } from "@nexus/core";
import { NexusError } from "@nexus/core";
import { contextToKmsRecord } from "./context.js";

/**
 * Production key management.
 *
 * The master key never leaves KMS. Nexus asks KMS for a data key and gets back
 * a plaintext copy (used immediately, held only in memory) and a wrapped copy
 * (stored). Every unwrap is an authenticated, logged KMS call, so "who read
 * this conversation" is answerable from CloudTrail as well as from our own
 * audit log.
 *
 * The SDK is imported dynamically so that development and test runs — and the
 * browser bundle — never pull it in.
 */
export class AwsKmsKeyManagement implements KeyManagement {
  readonly name = "aws-kms";
  readonly keyId: string;
  readonly #region: string;
  // Typed as unknown and narrowed at use, to avoid a static SDK import.
  #client: unknown = null;

  constructor(keyId: string, region: string) {
    this.keyId = keyId;
    this.#region = region;
  }

  async #kms(): Promise<{
    client: {
      send: (command: unknown) => Promise<{
        Plaintext?: Uint8Array;
        CiphertextBlob?: Uint8Array;
      }>;
    };
    GenerateDataKeyCommand: new (input: unknown) => unknown;
    DecryptCommand: new (input: unknown) => unknown;
  }> {
    const mod = await import("@aws-sdk/client-kms");
    this.#client ??= new mod.KMSClient({ region: this.#region });
    return {
      client: this.#client as never,
      GenerateDataKeyCommand: mod.GenerateDataKeyCommand as never,
      DecryptCommand: mod.DecryptCommand as never,
    };
  }

  async generateDataKey(context: EncryptionContext): Promise<{
    plaintextKey: Uint8Array;
    wrapped: WrappedDataKey;
  }> {
    const { client, GenerateDataKeyCommand } = await this.#kms();
    const result = await client.send(
      new GenerateDataKeyCommand({
        KeyId: this.keyId,
        KeySpec: "AES_256",
        EncryptionContext: contextToKmsRecord(context),
      }),
    );
    if (!result.Plaintext || !result.CiphertextBlob) {
      throw new NexusError("crypto_failure", "KMS returned an incomplete data key");
    }
    return {
      plaintextKey: result.Plaintext,
      wrapped: {
        wrapped: Buffer.from(result.CiphertextBlob).toString("base64"),
        keyId: this.keyId,
      },
    };
  }

  async unwrapDataKey(
    wrapped: WrappedDataKey,
    context: EncryptionContext,
  ): Promise<Uint8Array> {
    const { client, DecryptCommand } = await this.#kms();
    const result = await client.send(
      new DecryptCommand({
        KeyId: wrapped.keyId,
        CiphertextBlob: Buffer.from(wrapped.wrapped, "base64"),
        // KMS rejects the call outright if this does not match what was sealed.
        EncryptionContext: contextToKmsRecord(context),
      }),
    );
    if (!result.Plaintext) {
      throw new NexusError("crypto_failure", "KMS returned no plaintext data key");
    }
    return result.Plaintext;
  }
}
