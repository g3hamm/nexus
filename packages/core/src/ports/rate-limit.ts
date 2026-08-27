/**
 * Request throttling.
 *
 * Nexus is a public endpoint that, for every anonymous visitor who asks,
 * creates a conversation, provisions a realtime room, and asks a KMS for a
 * data key. Unthrottled that is somebody else's bill and, worse, a volunteer
 * queue full of noise with real seekers waiting behind it.
 */

export interface RateLimitResult {
  readonly allowed: boolean;
  /** Requests left in the current window. Zero when blocked. */
  readonly remaining: number;
  /** When the window rolls over and the caller may try again. */
  readonly resetAt: Date;
}

export interface RateLimitRule {
  /** What is being limited, e.g. "seeker.start". Namespaces the counter. */
  readonly scope: string;
  /** Requests permitted per window. */
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimiter {
  readonly name: string;
  /**
   * Counts one request against a rule.
   *
   * `identifier` is whatever distinguishes callers — usually a client address.
   * Implementations must not store it in a recoverable form.
   */
  check(rule: RateLimitRule, identifier: string): Promise<RateLimitResult>;
}

/**
 * The rules, in one place so they can be read and argued about together.
 *
 * Seekers get the most generous allowance of the three. Someone in distress
 * may legitimately start, abandon, and restart a conversation several times
 * before they can bring themselves to type the real thing — throttling that
 * person is a worse failure than absorbing some abuse, so the limit is set to
 * catch scripts rather than people.
 */
export const RATE_LIMITS = {
  /** Starting a conversation. Costs a room and a KMS data key each time. */
  seekerStart: { scope: "seeker.start", limit: 10, windowSeconds: 3600 },
  /** Sending a message. Loose enough that no real typist notices. */
  sendMessage: { scope: "message.send", limit: 120, windowSeconds: 60 },
  /** Sign-in attempts. Tight, because this is where credentials get stuffed. */
  login: { scope: "auth.login", limit: 10, windowSeconds: 900 },
  /** Volunteer applications. Nobody applies twice in an hour in good faith. */
  volunteerApply: { scope: "volunteer.apply", limit: 3, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;
