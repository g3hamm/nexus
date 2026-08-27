import "server-only";

import type { NextRequest } from "next/server";
import type { RateLimitRule } from "@nexus/core";
import { NexusError } from "@nexus/core";
import { container } from "./container";

/**
 * Identifies the caller for throttling purposes.
 *
 * Vercel sets `x-forwarded-for` with the client address first. Falling back to
 * a constant means that if the header is ever missing, every anonymous caller
 * shares one bucket — the limiter gets stricter rather than silently switching
 * itself off, which is the right direction for a control like this to fail in.
 */
export function callerIdentity(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || "unknown-caller";
}

/**
 * Counts a request against a rule and throws when it is over.
 *
 * The raw address never leaves this function — the limiter hashes it before
 * anything is stored, and the error carries no identifier at all.
 */
export async function enforceRateLimit(
  request: NextRequest,
  rule: RateLimitRule,
  identity: string = callerIdentity(request),
): Promise<void> {
  const result = await container().rateLimiter.check(rule, identity);
  if (result.allowed) return;

  const seconds = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
  throw new NexusError(
    "rate_limited",
    "That is more requests than we can accept right now. Please wait a little and try again.",
    { retryAfterSeconds: seconds },
  );
}
