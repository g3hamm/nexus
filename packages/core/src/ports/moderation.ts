import type { ModerationVerdict } from "../domain/moderation.js";
import type { ConversationWindow } from "./enablement.js";

/**
 * The judge.
 *
 * Same model family as the sidebar, different job and a different prompt: it
 * watches both parties and produces a structured verdict rather than advice.
 * It is intentionally advisory for everything short of a crisis or a clear
 * termination case — see `ModerationAction` for why.
 */
export interface Judge {
  readonly name: string;
  review(window: ConversationWindow, signal?: AbortSignal): Promise<ModerationVerdict>;
}

/**
 * Decides when to spend a judge call.
 *
 * Reviewing every message is expensive and mostly wasteful. Implementations
 * typically review on a cadence, on conversation start and end, and
 * immediately when a cheap local heuristic trips.
 */
export interface ModerationScheduler {
  shouldReview(window: ConversationWindow, lastReviewAt: Date | null): boolean;
}
