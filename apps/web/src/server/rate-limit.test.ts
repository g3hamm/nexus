import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { callerIdentity } from "./rate-limit";

function request(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("callerIdentity", () => {
  it("takes the client address from x-forwarded-for", () => {
    expect(callerIdentity(request({ "x-forwarded-for": "203.0.113.42" }))).toBe(
      "203.0.113.42",
    );
  });

  it("takes the first hop, not the proxies behind it", () => {
    // Vercel appends its own hops; the client is first.
    expect(
      callerIdentity(
        request({ "x-forwarded-for": "203.0.113.42, 70.41.3.18, 150.172.238.178" }),
      ),
    ).toBe("203.0.113.42");
  });

  it("tolerates the whitespace real proxies emit", () => {
    expect(
      callerIdentity(request({ "x-forwarded-for": "  203.0.113.42 , 70.41.3.18" })),
    ).toBe("203.0.113.42");
  });

  it("falls back to x-real-ip", () => {
    expect(callerIdentity(request({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("fails closed when no address is present", () => {
    // Everyone shares one bucket, so the limiter gets stricter rather than
    // silently switching itself off. That is the right direction for a
    // control like this to fail in.
    expect(callerIdentity(request({}))).toBe("unknown-caller");
    expect(callerIdentity(request({ "x-forwarded-for": "" }))).toBe("unknown-caller");
    expect(callerIdentity(request({ "x-forwarded-for": "   " }))).toBe("unknown-caller");
  });

  it("handles IPv6", () => {
    expect(
      callerIdentity(request({ "x-forwarded-for": "2001:db8::8a2e:370:7334" })),
    ).toBe("2001:db8::8a2e:370:7334");
  });
});
