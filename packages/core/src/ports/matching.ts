import type { Conversation } from "../domain/conversation.js";
import type { Volunteer } from "../domain/participants.js";

/**
 * Pairing a waiting seeker with a volunteer.
 *
 * Because translation sits under every message, a shared language is a
 * *preference* rather than a requirement — a Farsi speaker can be helped by
 * an English volunteer tonight instead of waiting for a Farsi one tomorrow.
 * A strategy that treats language as a hard filter would leave most of the
 * world queuing, which is the opposite of the point.
 */

export interface MatchCandidate {
  readonly volunteer: Volunteer;
  /** Higher is better. Comparable only within one ranking call. */
  readonly score: number;
  /** Why this volunteer scored as they did. Surfaced to admins, not seekers. */
  readonly reasons: readonly string[];
}

export interface MatchingStrategy {
  readonly name: string;
  rank(
    conversation: Conversation,
    volunteers: readonly Volunteer[],
  ): readonly MatchCandidate[];
}

export interface MatchResult {
  readonly conversation: Conversation;
  readonly volunteer: Volunteer;
}

export interface MatchingService {
  /** Attempt to match one waiting conversation. Null when nobody is free. */
  matchOne(): Promise<MatchResult | null>;
  /** Let a volunteer take a specific waiting conversation. */
  claim(conversationId: string, volunteer: Volunteer): Promise<MatchResult | null>;
}
