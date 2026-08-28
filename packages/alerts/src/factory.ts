import type { AlertChannel } from "@nexus/core";
import { ConsoleAlertChannel, WebhookAlertChannel } from "./webhook.js";

export interface AlertChannelOptions {
  /** Incoming webhook URL for Teams, Slack, or anything that accepts one. */
  readonly webhookUrl?: string | undefined;
}

/**
 * Chooses the channel from configuration.
 *
 * An unset webhook is a supported configuration, not an error — a small
 * deployment where an admin watches the flag queue is a legitimate way to
 * run this. It logs instead, so the signal still exists somewhere.
 *
 * A *malformed* webhook is different, and refusing it here beats discovering
 * it during the one incident it was configured for.
 */
export function createAlertChannel(options: AlertChannelOptions = {}): AlertChannel {
  const url = options.webhookUrl?.trim();
  if (!url) return new ConsoleAlertChannel();

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      "NEXUS_ALERT_WEBHOOK_URL is not a valid URL. Paste the full webhook address, starting with https://",
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      "NEXUS_ALERT_WEBHOOK_URL must be https. Alerts name a conversation to open, and that should not cross the network in the clear.",
    );
  }

  return new WebhookAlertChannel(parsed.toString());
}
