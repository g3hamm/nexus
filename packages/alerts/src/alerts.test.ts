import { afterEach, describe, expect, it, vi } from "vitest";
import { asConversationId, type OperationalAlert } from "@nexus/core";
import { createAlertChannel } from "./factory.js";
import { PAYLOAD_FOR_TESTS, WebhookAlertChannel } from "./webhook.js";

const alert: OperationalAlert = {
  severity: "urgent",
  title: "Someone may be at risk",
  detail: "Open the conversation and review it now.",
  conversationId: asConversationId("11111111-1111-4111-8111-111111111111"),
  url: "https://nexus.example/admin/conversations/11111111-1111-4111-8111-111111111111",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("payload shape", () => {
  it("leads with the one field Slack and Teams both understand", () => {
    const payload = PAYLOAD_FOR_TESTS(alert);
    expect(typeof payload.text).toBe("string");
    expect(payload.text as string).toContain("Someone may be at risk");
    expect(payload.text as string).toContain(alert.url!);
  });

  it("collapses a multi-line detail onto one line", () => {
    const payload = PAYLOAD_FOR_TESTS({
      ...alert,
      detail: "first line\n\n   second line\t\tthird",
    });
    const detail = (payload.nexus as { detail: string }).detail;
    expect(detail).toBe("first line second line third");
  });

  it("caps a detail that someone accidentally filled with a transcript", () => {
    const payload = PAYLOAD_FOR_TESTS({ ...alert, detail: "x".repeat(5_000) });
    const detail = (payload.nexus as { detail: string }).detail;
    expect(detail.length).toBe(400);
    expect(detail.endsWith("…")).toBe(true);
  });
});

describe("delivery", () => {
  it("posts JSON to the configured endpoint", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    await new WebhookAlertChannel("https://hooks.example/abc").send(alert);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://hooks.example/abc");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string) as {
      text: string;
    };
    expect(body.text).toContain("Someone may be at risk");
  });

  // The flag is already durable by the time this runs. A webhook outage must
  // not turn a recorded escalation into a thrown error.
  it("swallows a network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      new WebhookAlertChannel("https://hooks.example/abc").send(alert),
    ).resolves.toBeUndefined();
  });

  it("swallows a rejection from the endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("no", { status: 403 }),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await new WebhookAlertChannel("https://hooks.example/abc").send(alert);
    expect(logged).toHaveBeenCalled();
  });
});

describe("configuration", () => {
  it("falls back to logging when no webhook is set", async () => {
    const channel = createAlertChannel({});
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await channel.send(alert);
    expect(logged).toHaveBeenCalled();
  });

  it("treats an empty string as unset", () => {
    expect(createAlertChannel({ webhookUrl: "   " }).constructor.name).toBe(
      "ConsoleAlertChannel",
    );
  });

  it("refuses a plaintext endpoint", () => {
    expect(() => createAlertChannel({ webhookUrl: "http://hooks.example/abc" })).toThrow(
      /https/,
    );
  });

  it("refuses something that is not a URL at all", () => {
    expect(() => createAlertChannel({ webhookUrl: "paste-your-webhook-here" })).toThrow(
      /valid URL/,
    );
  });
});
