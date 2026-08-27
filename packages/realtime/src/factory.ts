import type { RealtimeTransport } from "@nexus/core";
import { NexusError } from "@nexus/core";
import { LiveKitTransport } from "./livekit.js";
import { InMemoryTransport } from "./memory.js";

export interface RealtimeConfig {
  readonly provider: string;
  readonly url?: string | undefined;
  readonly apiKey?: string | undefined;
  readonly apiSecret?: string | undefined;
  readonly isProduction: boolean;
}

export function createRealtimeTransport(config: RealtimeConfig): RealtimeTransport {
  switch (config.provider) {
    case "livekit":
      return new LiveKitTransport({
        url: config.url ?? "",
        apiKey: config.apiKey ?? "",
        apiSecret: config.apiSecret ?? "",
      });

    case "memory":
      if (config.isProduction) {
        throw new NexusError(
          "provider_unavailable",
          "The in-memory transport delivers nothing between processes and must " +
            "not be used in production. Set NEXUS_REALTIME_PROVIDER='livekit'.",
        );
      }
      return new InMemoryTransport();

    default:
      throw new NexusError(
        "provider_unavailable",
        `Unknown realtime provider "${config.provider}". Supported: livekit, memory.`,
      );
  }
}
