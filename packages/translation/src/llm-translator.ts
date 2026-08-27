import { z } from "zod";
import type {
  Glossary,
  LanguageDetectionResult,
  LlmProvider,
  TranslationRequest,
  TranslationResult,
  Translator,
} from "@nexus/core";
import { languageCodeSchema, sameLanguage } from "@nexus/core";
import { CHRISTIAN_GLOSSARY } from "./glossary.js";
import {
  buildTranslationSystemPrompt,
  LANGUAGE_DETECTION_PROMPT,
  TRANSLATION_USER_TEMPLATE,
} from "./prompts.js";

const translationSchema = z.object({
  translation: z.string(),
  confidence: z.number().min(0).max(1),
  glossaryHits: z
    .array(
      z.object({
        sourceTerm: z.string(),
        renderedAs: z.string(),
        note: z.string().optional(),
      }),
    )
    .default([]),
});

const detectionSchema = z.object({
  language: languageCodeSchema,
  confidence: z.number().min(0).max(1),
});

export interface LlmTranslatorOptions {
  readonly glossary?: Glossary;
  /** How many earlier turns to include as context. */
  readonly contextTurns?: number;
}

/**
 * Translation over the LLM port.
 *
 * Same-language pairs never reach the model — they short-circuit here. In a
 * service where a good share of conversations will be English-to-English,
 * that is the single largest cost and latency saving available.
 */
export class LlmTranslator implements Translator {
  readonly name = "llm";
  readonly #llm: LlmProvider;
  readonly #systemPrompt: string;
  readonly #glossary: Glossary;
  readonly #contextTurns: number;

  constructor(llm: LlmProvider, options: LlmTranslatorOptions = {}) {
    this.#llm = llm;
    this.#glossary = options.glossary ?? CHRISTIAN_GLOSSARY;
    this.#contextTurns = options.contextTurns ?? 6;
    // Built once. Reused byte-for-byte so the prompt cache actually hits.
    this.#systemPrompt = buildTranslationSystemPrompt(this.#glossary);
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (sameLanguage(request.from, request.to)) {
      return {
        text: request.text,
        from: request.from,
        to: request.to,
        engine: "passthrough",
        confidence: 1,
        glossaryHits: [],
      };
    }

    const context = (request.context ?? []).slice(-this.#contextTurns);

    const result = await this.#llm.completeStructured({
      task: "translation",
      system: this.#systemPrompt,
      messages: [
        {
          role: "user",
          content: TRANSLATION_USER_TEMPLATE(
            request.from,
            request.to,
            request.text,
            context,
          ),
        },
      ],
      schema: translationSchema,
      schemaName: "Translation",
      ...(request.signal ? { signal: request.signal } : {}),
    });

    return {
      text: result.value.translation,
      from: request.from,
      to: request.to,
      engine: `${this.#llm.name}:${result.model}`,
      confidence: result.value.confidence,
      glossaryHits: result.value.glossaryHits.map((h) => ({
        sourceTerm: h.sourceTerm,
        renderedAs: h.renderedAs,
        ...(h.note ? { note: h.note } : {}),
      })),
    };
  }

  async detectLanguage(
    text: string,
    signal?: AbortSignal,
  ): Promise<LanguageDetectionResult> {
    const result = await this.#llm.completeStructured({
      task: "language_detection",
      system: LANGUAGE_DETECTION_PROMPT,
      messages: [{ role: "user", content: text.slice(0, 1000) }],
      schema: detectionSchema,
      schemaName: "LanguageDetection",
      ...(signal ? { signal } : {}),
    });

    return {
      language: result.value.language,
      confidence: result.value.confidence,
    };
  }
}
