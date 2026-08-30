import { z } from "zod";
import type {
  BibleProvider,
  ConversationWindow,
  DoctrineProfile,
  EnablementEngine,
  EnablementSuggestions,
  KnowledgeBase,
  LlmProvider,
  Message,
  RetrievedChunk,
  SuggestedVerse,
} from "@nexus/core";
import { ECUMENICAL_PROFILE, renderingFor } from "@nexus/core";
import {
  buildEnablementPrompt,
  buildVersesPrompt,
  formatConversation,
  formatSources,
} from "./prompts.js";

/** Shared by the full schema and the verses-only one, so the two can never disagree on a verse's shape. */
const verseSuggestionSchema = z.object({
  book: z.string().min(1),
  chapter: z.number().int().min(1),
  verse: z.number().int().min(1).nullable(),
  endVerse: z.number().int().min(1).nullable(),
  rationale: z.string().min(1).max(500),
});

const suggestionsSchema = z.object({
  verses: z.array(verseSuggestionSchema).max(4),
  discussionPoints: z
    .array(
      z.object({
        text: z.string().min(1).max(500),
        intent: z.enum([
          "question",
          "bridge",
          "clarification",
          "caution",
          "encouragement",
        ]),
      }),
    )
    .max(6),
  understanding: z.object({
    summary: z.string().max(800),
    apparentNeed: z.string().max(400),
    cautions: z.array(z.string().max(300)).max(5),
    confidence: z.number().min(0).max(1),
  }),
});

const versesOnlySchema = z.object({
  verses: z.array(verseSuggestionSchema).max(4),
});

export interface LlmEnablementOptions {
  readonly doctrine?: DoctrineProfile;
  /** Recent turns to consider. */
  readonly windowSize?: number;
  /** Knowledge-base passages to retrieve. */
  readonly sourceLimit?: number;
  /** Optional — when present, verse previews are fetched for the panel. */
  readonly bible?: BibleProvider;
}

/**
 * The volunteer sidebar.
 *
 * Retrieves first, then suggests, so that what appears on the panel is
 * traceable to something a human vetted. A sidebar that improvises theology
 * confidently is worse than no sidebar: the volunteer cannot tell which parts
 * to trust, so they have to verify everything, which is slower than thinking
 * for themselves.
 */
export class LlmEnablementEngine implements EnablementEngine {
  readonly name = "llm";
  readonly #llm: LlmProvider;
  readonly #knowledge: KnowledgeBase;
  readonly #systemPrompt: string;
  readonly #versesSystemPrompt: string;
  readonly #windowSize: number;
  readonly #sourceLimit: number;
  readonly #doctrineId: string;
  readonly #bible: BibleProvider | undefined;

  constructor(
    llm: LlmProvider,
    knowledge: KnowledgeBase,
    options: LlmEnablementOptions = {},
  ) {
    const doctrine = options.doctrine ?? ECUMENICAL_PROFILE;
    this.#llm = llm;
    this.#knowledge = knowledge;
    this.#systemPrompt = buildEnablementPrompt(doctrine);
    this.#versesSystemPrompt = buildVersesPrompt(doctrine);
    this.#windowSize = options.windowSize ?? 20;
    this.#sourceLimit = options.sourceLimit ?? 6;
    this.#doctrineId = doctrine.id;
    this.#bible = options.bible;
  }

  async suggest(
    window: ConversationWindow,
    signal?: AbortSignal,
  ): Promise<EnablementSuggestions> {
    const recent = window.messages.slice(-this.#windowSize);
    if (recent.length === 0) return empty();

    const rendered = this.#render(recent, window);
    const sources = await this.#retrieve(rendered, signal);

    const result = await this.#llm.completeStructured({
      task: "enablement",
      system: this.#systemPrompt,
      messages: [{ role: "user", content: this.#userContent(rendered, sources) }],
      schema: suggestionsSchema,
      schemaName: "EnablementSuggestions",
      ...(signal ? { signal } : {}),
    });

    return {
      verses: await this.#withPreviews(result.value.verses, window, signal),
      discussionPoints: result.value.discussionPoints,
      understanding: result.value.understanding,
      sources,
      generatedAt: new Date(),
    };
  }

  /**
   * Verses only — a much smaller call than `suggest`, meant to run on a
   * cheap model after every new seeker message rather than on request. No
   * discussion points, no read on the seeker: this is deliberately not a
   * cut-down version of the full analysis, it is the one thing this pass is
   * actually asked to do.
   */
  async suggestVerses(
    window: ConversationWindow,
    signal?: AbortSignal,
  ): Promise<readonly SuggestedVerse[]> {
    const recent = window.messages.slice(-this.#windowSize);
    if (recent.length === 0) return [];

    const rendered = this.#render(recent, window);
    const sources = await this.#retrieve(rendered, signal);

    const result = await this.#llm.completeStructured({
      task: "enablement_verses",
      system: this.#versesSystemPrompt,
      messages: [{ role: "user", content: this.#userContent(rendered, sources) }],
      schema: versesOnlySchema,
      schemaName: "SuggestedVersesOnly",
      ...(signal ? { signal } : {}),
    });

    return this.#withPreviews(result.value.verses, window, signal);
  }

  /** Everything is read in the volunteer's language, so suggestions come back usable without a second translation hop. */
  #render(
    recent: readonly Message[],
    window: ConversationWindow,
  ): readonly { role: string; text: string }[] {
    return recent.map((message) => ({
      role: message.authorRole,
      text: renderingFor(message, window.volunteerLanguage).text,
    }));
  }

  #userContent(
    rendered: readonly { role: string; text: string }[],
    sources: readonly RetrievedChunk[],
  ): string {
    return [
      "<conversation>",
      formatConversation(rendered),
      "</conversation>",
      "",
      "<knowledge-base>",
      formatSources(
        sources.map((s) => ({
          title: s.chunk.title,
          source: s.chunk.source,
          text: s.chunk.text,
        })),
      ),
      "</knowledge-base>",
    ].join("\n");
  }

  /** Retrieval query is the recent seeker turns — what they said, not our reply. */
  async #retrieve(
    rendered: readonly { role: string; text: string }[],
    signal?: AbortSignal,
  ): Promise<readonly RetrievedChunk[]> {
    const seekerText = rendered
      .filter((m) => m.role === "seeker")
      .slice(-4)
      .map((m) => m.text)
      .join(" ");

    const query =
      seekerText.trim().length > 0 ? seekerText : rendered.map((m) => m.text).join(" ");

    try {
      return await this.#knowledge.search({
        text: query,
        limit: this.#sourceLimit,
        doctrineProfile: this.#doctrineId,
        ...(signal ? { signal } : {}),
      });
    } catch {
      // A knowledge base that is down should degrade the panel, not remove it.
      // The prompt already tells the model to say less without sources.
      return [];
    }
  }

  /** Fetches passage text so the panel renders without a second round trip. */
  async #withPreviews(
    verses: readonly {
      book: string;
      chapter: number;
      verse: number | null;
      endVerse: number | null;
      rationale: string;
    }[],
    window: ConversationWindow,
    signal?: AbortSignal,
  ): Promise<readonly SuggestedVerse[]> {
    return Promise.all(
      verses.map(async (v) => {
        const reference = {
          book: v.book,
          chapter: v.chapter,
          verse: v.verse,
          endVerse: v.endVerse,
        };

        let preview: string | null = null;
        if (this.#bible) {
          try {
            const passage = await this.#bible.lookup(reference, {
              language: window.volunteerLanguage,
              ...(signal ? { signal } : {}),
            });
            preview = passage ? passage.verses.map((pv) => pv.text).join(" ") : null;
          } catch {
            // Scripture lookup is not built yet, and when it is, a failure
            // should cost the preview and nothing else.
            preview = null;
          }
        }

        return { reference, rationale: v.rationale, preview };
      }),
    );
  }
}

function empty(): EnablementSuggestions {
  return {
    verses: [],
    discussionPoints: [],
    understanding: {
      summary: "",
      apparentNeed: "",
      cautions: [],
      confidence: 0,
    },
    sources: [],
    generatedAt: new Date(),
  };
}
