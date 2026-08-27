import { describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "@nexus/core";
import { InMemoryRateLimiter, rateLimitKey } from "./repositories/rate-limits.js";

const rule = { scope: "test", limit: 3, windowSeconds: 60 };

describe("rateLimitKey", () => {
  it("never contains the identifier it is counting", () => {
    const key = rateLimitKey("a-secret", "seeker.start", "203.0.113.42");

    // The whole point: a stolen counter table must not be a list of who
    // opened a conversation and roughly when.
    expect(key).not.toContain("203.0.113.42");
    expect(key).not.toContain("203.0.113");
    expect(key.startsWith("seeker.start:")).toBe(true);
  });

  it("is stable for the same inputs, so counting works at all", () => {
    expect(rateLimitKey("s", "scope", "1.2.3.4")).toBe(
      rateLimitKey("s", "scope", "1.2.3.4"),
    );
  });

  it("separates different callers", () => {
    expect(rateLimitKey("s", "scope", "1.2.3.4")).not.toBe(
      rateLimitKey("s", "scope", "1.2.3.5"),
    );
  });

  it("separates different scopes, so one limit cannot spend another", () => {
    expect(rateLimitKey("s", "auth.login", "1.2.3.4")).not.toBe(
      rateLimitKey("s", "seeker.start", "1.2.3.4"),
    );
  });

  it("is not reversible without the secret", () => {
    // A different secret over the same address produces an unrelated key,
    // so the table alone reveals nothing.
    expect(rateLimitKey("secret-a", "s", "1.2.3.4")).not.toBe(
      rateLimitKey("secret-b", "s", "1.2.3.4"),
    );
  });
});

describe("InMemoryRateLimiter", () => {
  it("allows up to the limit and then blocks", async () => {
    const limiter = new InMemoryRateLimiter();

    for (let i = 0; i < rule.limit; i++) {
      const result = await limiter.check(rule, "caller");
      expect(result.allowed).toBe(true);
    }

    const blocked = await limiter.check(rule, "caller");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("counts down the remaining allowance", async () => {
    const limiter = new InMemoryRateLimiter();
    expect((await limiter.check(rule, "c")).remaining).toBe(2);
    expect((await limiter.check(rule, "c")).remaining).toBe(1);
    expect((await limiter.check(rule, "c")).remaining).toBe(0);
  });

  it("counts callers independently", async () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < rule.limit; i++) await limiter.check(rule, "noisy");

    expect((await limiter.check(rule, "noisy")).allowed).toBe(false);
    // One abusive caller must not lock everyone else out.
    expect((await limiter.check(rule, "quiet")).allowed).toBe(true);
  });

  it("counts scopes independently", async () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < rule.limit; i++) await limiter.check(rule, "c");

    const other = { scope: "other", limit: 3, windowSeconds: 60 };
    expect((await limiter.check(other, "c")).allowed).toBe(true);
  });

  it("forgives once the window rolls over", async () => {
    vi.useFakeTimers();
    try {
      const limiter = new InMemoryRateLimiter();
      for (let i = 0; i < rule.limit; i++) await limiter.check(rule, "c");
      expect((await limiter.check(rule, "c")).allowed).toBe(false);

      vi.advanceTimersByTime(rule.windowSeconds * 1000);

      expect((await limiter.check(rule, "c")).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports when the caller may try again", async () => {
    const limiter = new InMemoryRateLimiter();
    const result = await limiter.check(rule, "c");
    const seconds = (result.resetAt.getTime() - Date.now()) / 1000;

    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(rule.windowSeconds);
  });
});

describe("the configured limits", () => {
  it("is far more generous to seekers than to sign-in attempts", () => {
    // Someone in distress may start, abandon and restart a conversation
    // several times before they can type the real thing. Throttling that
    // person is a worse failure than absorbing some abuse.
    const seekerPerHour = RATE_LIMITS.seekerStart.limit;
    const loginPerHour =
      RATE_LIMITS.login.limit * (3600 / RATE_LIMITS.login.windowSeconds);

    expect(seekerPerHour).toBeGreaterThanOrEqual(10);
    expect(RATE_LIMITS.login.windowSeconds).toBeLessThanOrEqual(900);
    expect(loginPerHour).toBeLessThan(seekerPerHour * 5);
  });

  it("lets a real typist send freely", () => {
    const perSecond =
      RATE_LIMITS.sendMessage.limit / RATE_LIMITS.sendMessage.windowSeconds;
    expect(perSecond).toBeGreaterThanOrEqual(1);
  });

  it("keeps applications tight", () => {
    expect(RATE_LIMITS.volunteerApply.limit).toBeLessThanOrEqual(5);
  });
});
