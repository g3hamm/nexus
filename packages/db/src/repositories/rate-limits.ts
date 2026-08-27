import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import type { RateLimiter, RateLimitResult, RateLimitRule } from "@nexus/core";
import type { NexusDatabase } from "../client.js";
import { rateLimits } from "../schema.js";

/**
 * The key a counter is stored under.
 *
 * Never the raw identifier. A table of IP addresses belonging to people who
 * opened a conversation about Jesus is precisely the artefact this system goes
 * out of its way not to create — and a rate limiter is an easy place to
 * recreate it by accident. An HMAC counts just as well and is useless to
 * anyone who steals the table.
 *
 * Exported so that property can be tested rather than merely asserted here.
 */
export function rateLimitKey(secret: string, scope: string, identifier: string): string {
  const digest = createHmac("sha256", secret)
    .update(`${scope}:${identifier}`)
    .digest("base64url");
  return `${scope}:${digest.slice(0, 32)}`;
}

/**
 * A fixed-window limiter in Postgres.
 *
 * One atomic upsert per check, which is cheap next to what these endpoints
 * already do — the request being throttled provisions a realtime room and
 * asks a KMS for a key. No Redis, no extra vendor.
 *
 * Fixed windows allow a burst across a boundary (up to 2× the limit in a
 * moment) and that is an accepted trade. A sliding log would cost a row per
 * request to defend against a burst pattern that does not matter here: the
 * point is to stop scripts and runaway bills, not to police the millisecond.
 */
export class PostgresRateLimiter implements RateLimiter {
  readonly name = "postgres";
  readonly #db: NexusDatabase;
  readonly #secret: string;

  constructor(db: NexusDatabase, hashSecret: string) {
    this.#db = db;
    this.#secret = hashSecret;
  }

  async check(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
    const windowMs = rule.windowSeconds * 1000;
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const resetAt = new Date(windowStart.getTime() + windowMs);

    const key = this.#key(rule.scope, identifier);

    const rows = await this.#db
      .insert(rateLimits)
      .values({ key, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          // Same window: count up. New window: start over. Doing both in one
          // statement is what makes this safe against concurrent requests.
          count: sql`case when ${rateLimits.windowStart} = ${windowStart}
                          then ${rateLimits.count} + 1 else 1 end`,
          windowStart,
        },
      })
      .returning({ count: rateLimits.count });

    const count = rows[0]?.count ?? 1;
    return {
      allowed: count <= rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetAt,
    };
  }

  #key(scope: string, identifier: string): string {
    return rateLimitKey(this.#secret, scope, identifier);
  }

  /** Sweeps windows that can no longer matter. Called by the nightly purge. */
  async prune(olderThan: Date): Promise<number> {
    const deleted = await this.#db
      .delete(rateLimits)
      .where(sql`${rateLimits.windowStart} < ${olderThan}`)
      .returning({ key: rateLimits.key });
    return deleted.length;
  }
}

/**
 * An in-process limiter for tests and local development.
 *
 * Counts per process, so several serverless instances would each get their own
 * allowance — useless in production, which is why the factory refuses it there.
 */
export class InMemoryRateLimiter implements RateLimiter {
  readonly name = "memory";
  readonly #counters = new Map<string, { count: number; windowStart: number }>();

  async check(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
    const windowMs = rule.windowSeconds * 1000;
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const key = `${rule.scope}:${identifier}`;

    const existing = this.#counters.get(key);
    const count =
      existing && existing.windowStart === windowStart ? existing.count + 1 : 1;
    this.#counters.set(key, { count, windowStart });

    return {
      allowed: count <= rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetAt: new Date(windowStart + windowMs),
    };
  }

  reset(): void {
    this.#counters.clear();
  }
}
