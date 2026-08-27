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
  /**
   * Deliberate opt-out of the production guard below, for trial and staging
   * deployments where standing up a KMS is not yet worth it.
   *
   * Named so it cannot be set by accident or mistaken for something benign,
   * and it warns on every boot. The guard exists so nobody ships to
   * production on an environment-variable key *without noticing* — not to
   * make evaluating Nexus require an AWS account.
   */
  readonly allowInsecureLocalKeyInProduction?: boolean;
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
    if (!config.allowInsecureLocalKeyInProduction) {
      throw new NexusError(
        "crypto_failure",
        "Refusing to start: NEXUS_KMS_PROVIDER is 'local' in production. " +
          "A master key in an environment variable is readable by anything that " +
          "can read the environment. Set NEXUS_KMS_PROVIDER='aws' and " +
          "AWS_KMS_KEY_ID. To run a trial deployment anyway, set " +
          "NEXUS_ALLOW_INSECURE_LOCAL_KMS='true' — do not do this with real " +
          "conversations in the database.",
      );
    }
    console.warn(
      "\n" +
        "  ┌──────────────────────────────────────────────────────────────┐\n" +
        "  │  NEXUS IS RUNNING WITH AN INSECURE MASTER KEY                 │\n" +
        "  │                                                              │\n" +
        "  │  Conversation keys are wrapped by a key held in an            │\n" +
        "  │  environment variable. Anything that can read the             │\n" +
        "  │  environment can read every transcript.                       │\n" +
        "  │                                                              │\n" +
        "  │  Acceptable for a trial. Not acceptable once real people      │\n" +
        "  │  are talking. Move to NEXUS_KMS_PROVIDER='aws' first.         │\n" +
        "  └──────────────────────────────────────────────────────────────┘\n",
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
