import type { ConversationId } from "../domain/ids.js";
import type { LanguageCode } from "../domain/language.js";
import type { Message } from "../domain/message.js";
import type { VerseReference } from "../domain/scripture.js";
import type { RetrievedChunk } from "./knowledge.js";

/**
 * The volunteer's sidebar.
 *
 * It listens and offers; it never speaks. Every suggestion is something the
 * volunteer chooses to pull into the conversation, in their own words or
 * verbatim. That boundary is deliberate — the seeker came to talk to a
 * person, and a sidebar that could post on the volunteer's behalf would
 * quietly turn this into a chatbot.
 */

export interface ConversationWindow {
  readonly conversationId: ConversationId;
  /** Recent messages, oldest first. Implementations bound this themselves. */
  readonly messages: readonly Message[];
  /** Language the volunteer reads, so suggestions come back usable. */
  readonly volunteerLanguage: LanguageCode;
  readonly seekerLanguage: LanguageCode;
}

export interface SuggestedVerse {
  readonly reference: VerseReference;
  /** Why this passage, for this moment. One or two sentences. */
  readonly rationale: string;
  /** The passage text, pre-fetched so the sidebar renders without a round trip. */
  readonly preview: string | null;
}

export interface DiscussionPoint {
  readonly text: string;
  /** What this is for: a question to ask, a bridge, a caution. */
  readonly intent: "question" | "bridge" | "clarification" | "caution" | "encouragement";
}

/**
 * The sidebar's read on who it is listening to.
 *
 * Written to be read by a volunteer mid-conversation: short, concrete, and
 * hedged where the evidence is thin. It is a working hypothesis, not a dossier,
 * and the UI should present it that way.
 */
export interface SeekerUnderstanding {
  /** Where they seem to be coming from — background, worldview, prior exposure. */
  readonly summary: string;
  /** What actually seems to be driving the conversation. */
  readonly apparentNeed: string;
  /** Sensitivities worth not stepping on. */
  readonly cautions: readonly string[];
  /** 0..1 — how much of this is inference versus something they said outright. */
  readonly confidence: number;
}

export interface EnablementSuggestions {
  readonly verses: readonly SuggestedVerse[];
  readonly discussionPoints: readonly DiscussionPoint[];
  readonly understanding: SeekerUnderstanding;
  /** Knowledge-base passages the suggestions were drawn from, for citation. */
  readonly sources: readonly RetrievedChunk[];
  readonly generatedAt: Date;
}

export interface EnablementEngine {
  readonly name: string;
  suggest(
    window: ConversationWindow,
    signal?: AbortSignal,
  ): Promise<EnablementSuggestions>;
  /**
   * Verses only, meant to run automatically after every new seeker message —
   * a much smaller call than `suggest`, on a much cheaper model, so it can
   * run far more often without either the cost or the latency of the full
   * analysis. See the enablement-cache design for how the two are merged.
   */
  suggestVerses(
    window: ConversationWindow,
    signal?: AbortSignal,
  ): Promise<readonly SuggestedVerse[]>;
}
