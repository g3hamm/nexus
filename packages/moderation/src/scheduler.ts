import type { ConversationWindow, ModerationScheduler } from "@nexus/core";
import { original, renderingFor } from "@nexus/core";

/**
 * Phrases that pull a review forward regardless of cadence.
 *
 * English-only, and that is deliberate rather than lazy: every message already
 * carries an English rendering produced by the translation layer, so matching
 * English catches a Farsi seeker's crisis language too. It is a tripwire, not
 * a classifier — false positives cost one model call, and the judge decides.
 */
const URGENT_PATTERNS: readonly RegExp[] = [
  // Risk to life. Deliberately broad; the judge sorts out idiom from intent.
  /\b(kill myself|end my life|want to die|take my own life|no reason to live|better off dead|suicide|hurt myself)\b/i,
  // Moving off-platform, where there is no translation, audit, or protection.
  /\b(whatsapp|telegram|signal|instagram|snapchat|my number|phone number|text me|email me|add me on)\b/i,
  // Money and inducements.
  /\b(send money|wire|western union|paypal|venmo|sponsor(ship)?|visa|pay you|gift card)\b/i,
  // Threats.
  /\b(kill you|hurt you|find you|i will report you|you will burn)\b/i,
];

export interface CadenceOptions {
  /** Review after this many new messages. */
  readonly everyMessages?: number;
  /** Review at least this often while a conversation is active. */
  readonly everyMs?: number;
}

/**
 * Decides when a review is worth its cost.
 *
 * Reviewing every message would roughly double the model spend of the whole
 * product for very little added protection. This reviews early, on a cadence,
 * and immediately when a cheap local check trips.
 */
export class CadenceModerationScheduler implements ModerationScheduler {
  readonly #everyMessages: number;
  readonly #everyMs: number;

  constructor(options: CadenceOptions = {}) {
    this.#everyMessages = options.everyMessages ?? 6;
    this.#everyMs = options.everyMs ?? 5 * 60_000;
  }

  shouldReview(window: ConversationWindow, lastReviewAt: Date | null): boolean {
    const count = window.messages.length;
    if (count === 0) return false;

    // Anything urgent jumps the queue immediately.
    if (this.#hasUrgentSignal(window)) return true;

    // Look early. The opening exchanges are where a conversation that is going
    // to go wrong usually shows it.
    if (lastReviewAt === null) return count >= 2;

    if (Date.now() - lastReviewAt.getTime() >= this.#everyMs) return true;

    return count % this.#everyMessages === 0;
  }

  /** Only inspects the newest message; earlier ones were already checked. */
  #hasUrgentSignal(window: ConversationWindow): boolean {
    const latest = window.messages.at(-1);
    if (!latest) return false;

    const texts = [original(latest).text, renderingFor(latest, "en").text];
    return texts.some((text) => URGENT_PATTERNS.some((p) => p.test(text)));
  }
}

export const URGENT_PATTERNS_FOR_TESTS = URGENT_PATTERNS;
