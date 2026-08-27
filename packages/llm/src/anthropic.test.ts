import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { isNexusError } from "@nexus/core";
import { AnthropicProvider } from "./anthropic.js";
import { FakeLlmProvider } from "./fake.js";
import { StaticModelRouter, DEFAULT_MODEL, TASK_DEFAULTS } from "./models.js";

const verdictSchema = z.object({
  severity: z.enum(["none", "low", "high"]),
  rationale: z.string(),
});

/** Minimal stand-in for the SDK surface the provider actually touches. */
function stubClient(parseImpl: (...args: unknown[]) => unknown): Anthropic {
  return {
    beta: { messages: { parse: vi.fn(parseImpl), create: vi.fn(), stream: vi.fn() } },
  } as unknown as Anthropic;
}

function reply(parsed: unknown, text = "") {
  return {
    parsed_output: parsed,
    content: text ? [{ type: "text", text }] : [],
    model: "claude-opus-5",
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 },
  };
}

describe("AnthropicProvider.completeStructured", () => {
  it("returns validated output on the first attempt", async () => {
    const client = stubClient(async () =>
      reply({ severity: "none", rationale: "nothing of concern" }),
    );
    const provider = new AnthropicProvider({ client });

    const result = await provider.completeStructured({
      task: "moderation",
      messages: [{ role: "user", content: "review this" }],
      schema: verdictSchema,
      schemaName: "Verdict",
    });

    expect(result.attempts).toBe(1);
    expect(result.value.severity).toBe("none");
  });

  it("re-asks when the model returns a shape the schema rejects", async () => {
    let call = 0;
    const client = stubClient(async () => {
      call++;
      // First attempt uses a severity value outside the enum.
      return call === 1
        ? reply({ severity: "catastrophic", rationale: "bad" }, "oops")
        : reply({ severity: "high", rationale: "threat of violence" });
    });
    const provider = new AnthropicProvider({ client });

    const result = await provider.completeStructured({
      task: "moderation",
      messages: [{ role: "user", content: "review this" }],
      schema: verdictSchema,
      schemaName: "Verdict",
    });

    expect(result.attempts).toBe(2);
    expect(result.value.severity).toBe("high");
  });

  it("re-asks when the model returns nothing parseable", async () => {
    let call = 0;
    const client = stubClient(async () => {
      call++;
      return call === 1
        ? reply(null, "Sure! Here is the verdict:")
        : reply({ severity: "low", rationale: "mild profanity" });
    });
    const provider = new AnthropicProvider({ client });

    const result = await provider.completeStructured({
      task: "moderation",
      messages: [{ role: "user", content: "review" }],
      schema: verdictSchema,
      schemaName: "Verdict",
    });

    expect(result.attempts).toBe(2);
  });

  it("feeds the validation failure back into the next attempt", async () => {
    const seen: unknown[][] = [];
    let call = 0;
    const client = stubClient(async (params: unknown) => {
      seen.push((params as { messages: unknown[] }).messages);
      call++;
      return call === 1
        ? reply({ severity: "nope", rationale: "x" }, "bad output")
        : reply({ severity: "none", rationale: "fine" });
    });
    const provider = new AnthropicProvider({ client });

    await provider.completeStructured({
      task: "moderation",
      messages: [{ role: "user", content: "review" }],
      schema: verdictSchema,
      schemaName: "Verdict",
    });

    // Second attempt carries the original turn plus the correction exchange.
    expect(seen[1]).toHaveLength(3);
    expect(JSON.stringify(seen[1])).toContain("did not match the required Verdict");
  });

  it("gives up after the attempt limit rather than looping forever", async () => {
    const client = stubClient(async () => reply({ severity: "wrong", rationale: "x" }));
    const provider = new AnthropicProvider({ client, maxStructuredAttempts: 2 });

    await expect(
      provider.completeStructured({
        task: "moderation",
        messages: [{ role: "user", content: "review" }],
        schema: verdictSchema,
        schemaName: "Verdict",
      }),
    ).rejects.toThrow(/after 2 attempts/);
  });

  it("surfaces a provider refusal as a typed error", async () => {
    const client = stubClient(async () => ({
      ...reply(null),
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "bio", explanation: "declined" },
    }));
    const provider = new AnthropicProvider({ client });

    try {
      await provider.completeStructured({
        task: "moderation",
        messages: [{ role: "user", content: "review" }],
        schema: verdictSchema,
        schemaName: "Verdict",
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(isNexusError(e)).toBe(true);
      expect((e as { code: string }).code).toBe("provider_refused");
    }
  });
});

describe("StaticModelRouter", () => {
  it("defaults every task to the most capable model", () => {
    const router = new StaticModelRouter();
    expect(router.modelFor("translation")).toBe(DEFAULT_MODEL);
    expect(router.modelFor("moderation")).toBe(DEFAULT_MODEL);
  });

  it("lets an operator override a single task from the environment", () => {
    const router = StaticModelRouter.fromEnv({
      NEXUS_MODEL_TRANSLATION: "claude-haiku-4-5",
    });
    expect(router.modelFor("translation")).toBe("claude-haiku-4-5");
    expect(router.modelFor("moderation")).toBe(DEFAULT_MODEL);
  });

  it("keeps translation in the low-latency band and moderation careful", () => {
    expect(TASK_DEFAULTS.translation.effort).toBe("low");
    expect(TASK_DEFAULTS.moderation.effort).toBe("high");
  });
});

describe("FakeLlmProvider", () => {
  it("returns scripted structured values", async () => {
    const fake = new FakeLlmProvider().on({
      task: "moderation",
      value: { severity: "none", rationale: "all clear" },
    });

    const result = await fake.completeStructured({
      task: "moderation",
      messages: [{ role: "user", content: "review" }],
      schema: verdictSchema,
      schemaName: "Verdict",
    });

    expect(result.value.rationale).toBe("all clear");
    expect(fake.calls).toHaveLength(1);
  });

  it("rejects a fixture the real schema would not accept", async () => {
    const fake = new FakeLlmProvider().on({
      task: "moderation",
      value: { severity: "made-up", rationale: "x" },
    });

    await expect(
      fake.completeStructured({
        task: "moderation",
        messages: [{ role: "user", content: "review" }],
        schema: verdictSchema,
        schemaName: "Verdict",
      }),
    ).rejects.toThrow(/does not satisfy Verdict/);
  });

  it("explains itself when nothing is scripted", async () => {
    const fake = new FakeLlmProvider();
    await expect(
      fake.completeStructured({
        task: "enablement",
        messages: [{ role: "user", content: "help" }],
        schema: verdictSchema,
        schemaName: "Verdict",
      }),
    ).rejects.toThrow(/no scripted value/);
  });
});
