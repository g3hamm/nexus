import type { ConversationCrypto, KeyManagement } from "@nexus/core";
import { NexusError } from "@nexus/core";
import { AwsKmsKeyManagement } from "./aws-kms.js";
import { EnvelopeCrypto } from "./envelope.js";
import { LocalKeyManagement } from "./local-kms.js";

export interface CryptoConfig {
  readonly provider: "local" | "aws";
  readonly masterKeyBase64?: string | undefined;
  readonly awsKeyId?: string | undefined;
  readonly awsRegion?: string | undefined;
  readonly isProduction: boolean;
}

/**
 * Builds key management from configuration.
 *
 * The production guard is the point of this function. It is far too easy to
 * ship to production with NEXUS_KMS_PROVIDER still on "local" and never
 * notice, because everything keeps working — the encryption is real, it is
 * just anchored to a key sitting in an environment variable. So: refuse.
 */
export function createKeyManagement(config: CryptoConfig): KeyManagement {
  if (config.provider === "aws") {
    if (!config.awsKeyId) {
      throw new NexusError(
        "crypto_failure",
        "AWS_KMS_KEY_ID is required when NEXUS_KMS_PROVIDER is 'aws'",
      );
    }
    return new AwsKmsKeyManagement(config.awsKeyId, config.awsRegion ?? "us-east-1");
  }

  if (config.isProduction) {
    throw new NexusError(
      "crypto_failure",
      "Refusing to start: NEXUS_KMS_PROVIDER is 'local' in production. " +
        "A master key in an environment variable is readable by anything that can " +
        "read the environment. Set NEXUS_KMS_PROVIDER='aws' and AWS_KMS_KEY_ID.",
    );
  }

  if (!config.masterKeyBase64) {
    throw new NexusError(
      "crypto_failure",
      "NEXUS_MASTER_KEY is required for local key management. " +
        "Generate one with: openssl rand -base64 32",
    );
  }

  return LocalKeyManagement.fromBase64(config.masterKeyBase64);
}

export function createConversationCrypto(config: CryptoConfig): ConversationCrypto {
  return new EnvelopeCrypto(createKeyManagement(config));
}
