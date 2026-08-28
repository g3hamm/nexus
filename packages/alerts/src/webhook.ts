import type { AlertChannel, OperationalAlert } from "@nexus/core";

/** Long enough for a slow corporate endpoint, short enough not to hang a request. */
const TIMEOUT_MS = 4_000;

/**
 * Posts alerts to an incoming webhook — a Teams channel, a Slack channel.
 *
 * The payload leads with `text`, which is the one field both Slack and Teams
 * understand without configuration, and carries the structured fields beside
 * it for anyone who wants to build a nicer card later. Extra keys are ignored
 * by both.
 *
 * Never throws. A church's Teams tenant having a bad afternoon must not stop
 * a flag being raised, and the flag is the durable part.
 */
export class WebhookAlertChannel implements AlertChannel {
  readonly #url: string;

  constructor(url: string) {
    this.#url = url;
  }

  async send(alert: OperationalAlert): Promise<void> {
    try {
      const response = await fetch(this.#url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toPayload(alert)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        console.error("[nexus] alert webhook rejected", {
          status: response.status,
        });
      }
    } catch (error) {
      console.error("[nexus] alert webhook failed", { error });
    }
  }
}

/**
 * Where alerts go when no webhook is configured.
 *
 * Deliberately loud on stderr rather than silent, so a deployment that forgot
 * to set the webhook still leaves a trail in the platform logs instead of
 * dropping the one message that mattered.
 */
export class ConsoleAlertChannel implements AlertChannel {
  async send(alert: OperationalAlert): Promise<void> {
    const line = `[nexus] ALERT ${alert.severity.toUpperCase()}: ${alert.title} — ${alert.detail}`;
    console.error(line, alert.conversationId ? { conversationId: alert.conversationId } : {});
    return Promise.resolve();
  }
}

/**
 * Belt and braces on the "no content in alerts" rule.
 *
 * The type already has nowhere to put a transcript, but a caller can always
 * interpolate one into `detail` by mistake. Alerts land in third-party chat
 * tools outside our encryption and outside our retention policy, so the
 * boundary is enforced here as well as documented: single line, hard cap.
 */
function clamp(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

function toPayload(alert: OperationalAlert): Record<string, unknown> {
  const title = clamp(alert.title, 120);
  const detail = clamp(alert.detail, 400);
  const parts = [alert.severity === "urgent" ? `🔴 ${title}` : title, detail];
  if (alert.url) parts.push(alert.url);

  return {
    text: parts.join("\n"),
    nexus: {
      severity: alert.severity,
      title,
      detail,
      conversationId: alert.conversationId ?? null,
      url: alert.url ?? null,
    },
  };
}

export const PAYLOAD_FOR_TESTS = toPayload;
