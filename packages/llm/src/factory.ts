import type { LlmProvider } from "@nexus/core";
import { NexusError } from "@nexus/core";
import { AnthropicProvider } from "./anthropic.js";
import { FakeLlmProvider } from "./fake.js";
import { StaticModelRouter } from "./models.js";

export interface LlmConfig {
  readonly provider: string;
  readonly anthropicApiKey?: string | undefined;
  readonly env?: Record<string, string | undefined>;
  readonly isProduction?: boolean;
}

/**
 * Builds the LLM provider from configuration.
 *
 * This function is the whole "swappable LLM" story. Adding a provider means
 * writing one adapter and adding one case here; no feature code changes,
 * because nothing above the port knows a provider exists.
 */
export function createLlmProvider(config: LlmConfig): LlmProvider {
  const router = StaticModelRouter.fromEnv(config.env ?? process.env);

  switch (config.provider) {
    case "anthropic":
      if (!config.anthropicApiKey) {
        throw new NexusError(
          "provider_unavailable",
          "ANTHROPIC_API_KEY is required when NEXUS_LLM_PROVIDER is 'anthropic'. " +
            "Set NEXUS_LLM_PROVIDER='fake' to run without a key.",
        );
      }
      return new AnthropicProvider({ apiKey: config.anthropicApiKey, router });

    case "fake":
      if (config.isProduction) {
        throw new NexusError(
          "provider_unavailable",
          "The fake LLM provider returns empty translations and must not be used " +
            "in production. Set NEXUS_LLM_PROVIDER='anthropic'.",
        );
      }
      return new FakeLlmProvider();

    default:
      throw new NexusError(
        "provider_unavailable",
        `Unknown LLM provider "${config.provider}". Supported: anthropic, fake.`,
      );
  }
}
