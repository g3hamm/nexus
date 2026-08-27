import { z } from "zod";
import type {
  BibleProvider,
  ConversationWindow,
  DoctrineProfile,
  EnablementEngine,
  EnablementSuggestions,
  KnowledgeBase,
  LlmProvider,
  RetrievedChunk,
  SuggestedVerse,
} from "@nexus/core";
import { ECUMENICAL_PROFILE, renderingFor } from "@nexus/core";
import { buildEnablementPrompt, formatConversation, formatSources } from "./prompts.js";

const suggestionsSchema = z.object({
  verses: z
    .array(
      z.object({
        book: z.string().min(1),
        chapter: z.number().int().min(1),
        verse: z.number().int().min(1).nullable(),
        endVerse: z.number().int().min(1).nullable(),
        rationale: z.string().min(1).max(500),
      }),
    )
    .max(4),
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

    // Everything is read in the volunteer's language, so suggestions come back
    // usable rather than needing a second translation hop.
    const rendered = recent.map((message) => ({
      role: message.authorRole,
      text: renderingFor(message, window.volunteerLanguage).text,
    }));

    const sources = await this.#retrieve(rendered, signal);

    const result = await this.#llm.completeStructured({
      task: "enablement",
      system: this.#systemPrompt,
      messages: [
        {
          role: "user",
          content: [
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
          ].join("\n"),
        },
      ],
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
