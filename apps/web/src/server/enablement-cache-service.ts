import "server-only";

import type {
  CachedFullSuggestions,
  ConversationId,
  ConversationWindow,
  DiscussionPoint,
  RetrievedChunk,
  SeekerUnderstanding,
  SuggestedVerse,
} from "@nexus/core";
import { NexusError } from "@nexus/core";
import type { Container } from "./container";

export interface MergedSuggestions {
  readonly ready: boolean;
  readonly verses: readonly SuggestedVerse[];
  readonly discussionPoints: readonly DiscussionPoint[];
  readonly understanding: SeekerUnderstanding | null;
  readonly sources: readonly RetrievedChunk[];
  readonly generatedAt: Date | null;
}

const EMPTY: MergedSuggestions = {
  ready: false,
  verses: [],
  discussionPoints: [],
  understanding: null,
  sources: [],
  generatedAt: null,
};

/**
 * The volunteer sidebar's two cached tiers, read and written together.
 *
 * `getSuggestions` is the foreground path — an HTTP caller is waiting on
 * it — so unlike `refreshVerses` below it does not catch its own errors;
 * the route's existing `errorResponse()` handles that the same way it
 * always has. `refreshVerses` is the opposite: called from `after()` with
 * no caller left to answer, so it must never let anything escape.
 */
export class EnablementCacheService {
  readonly #c: Container;
  readonly #windowSize: number;

  constructor(container: Container, options: { windowSize?: number } = {}) {
    this.#c = container;
    this.#windowSize = options.windowSize ?? 20;
  }

  /**
   * The full tier, bootstrapped or force-refreshed as needed, with the
   * freshest available verses layered on top — which may be newer than the
   * full tier's own bundled verses, since those regenerate independently
   * after every seeker message. "Freshest wins" by comparing timestamps,
   * not "the verses tier always wins": a forced full refresh's own verses
   * are newer immediately after it runs, so clicking "Update" is enough to
   * refresh what's shown without any special-casing.
   */
  async getSuggestions(
    conversationId: ConversationId,
    options: { forceRefresh?: boolean } = {},
  ): Promise<MergedSuggestions> {
    const conversation = await this.#c.conversations.findById(conversationId);
    if (!conversation) throw NexusError.notFound("Conversation", conversationId);

    const messages = await this.#c.messages.listForConversation(conversationId, {
      limit: this.#windowSize,
    });

    // Nothing said yet, so nothing worth spending a model call on — and
    // nothing gets cached for a conversation that hasn't started.
    if (messages.length === 0) return EMPTY;

    const window: ConversationWindow = {
      conversationId,
      messages,
      volunteerLanguage: conversation.volunteerLanguage ?? "en",
      seekerLanguage: conversation.seekerLanguage,
    };

    const cache = await this.#c.enablementCache.find(conversationId);

    let full: CachedFullSuggestions;
    if (options.forceRefresh || !cache.full) {
      const suggestions = await this.#c.enablement.suggest(window);
      await this.#c.enablementCache.writeFull(
        conversationId,
        suggestions,
        messages.length,
      );
      full = { ...suggestions, messageCount: messages.length };
    } else {
      full = cache.full;
    }

    const verses =
      cache.verses && cache.verses.generatedAt >= full.generatedAt
        ? cache.verses.verses
        : full.verses;

    return {
      ready: true,
      verses,
      discussionPoints: full.discussionPoints,
      understanding: full.understanding,
      sources: full.sources,
      generatedAt: full.generatedAt,
    };
  }

  /**
   * Verses only, meant to be called from `after()` after every new seeker
   * message. No safety net out there — anything this throws is simply
   * lost — so the whole body is wrapped and every failure is logged and
   * swallowed, the same shape as `ModerationService.reviewIfDue`.
   */
  async refreshVerses(conversationId: ConversationId): Promise<void> {
    try {
      const conversation = await this.#c.conversations.findById(conversationId);
      if (!conversation) return;
      // Nothing to suggest for a conversation nobody can speak in any more.
      if (conversation.status !== "active" && conversation.status !== "waiting") return;

      const messages = await this.#c.messages.listForConversation(conversationId, {
        limit: this.#windowSize,
      });
      if (messages.length === 0) return;

      const window: ConversationWindow = {
        conversationId,
        messages,
        volunteerLanguage: conversation.volunteerLanguage ?? "en",
        seekerLanguage: conversation.seekerLanguage,
      };

      const verses = await this.#c.enablement.suggestVerses(window);
      await this.#c.enablementCache.writeVerses(
        conversationId,
        verses,
        new Date(),
        messages.length,
      );
    } catch (error) {
      console.error("[nexus] enablement verses refresh failed", {
        conversationId,
        error,
      });
    }
  }
}
