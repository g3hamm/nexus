import { describe, expect, it } from "vitest";
import { createLlmProvider } from "./factory.js";

describe("createLlmProvider", () => {
  it("refuses the fake provider in production", () => {
    expect(() => createLlmProvider({ provider: "fake", isProduction: true })).toThrow(
      /must not be used in production/,
    );
  });

  it("allows the fake provider in development", () => {
    expect(createLlmProvider({ provider: "fake" }).name).toBe("fake");
  });

  it("requires an API key for the Anthropic provider", () => {
    expect(() => createLlmProvider({ provider: "anthropic" })).toThrow(
      /ANTHROPIC_API_KEY is required/,
    );
  });

  it("rejects an unknown provider by name", () => {
    expect(() => createLlmProvider({ provider: "wishful-thinking" })).toThrow(
      /Unknown LLM provider/,
    );
  });
});
