import type { LanguageCode } from "../domain/language.js";

/**
 * Translation, with the Christian sense of the vocabulary preserved.
 *
 * The problem this port exists to solve: general-purpose translation flattens
 * "grace" into "mercy" or "a favour", "faith" into "confidence", "spirit" into
 * "mood", and "the Word" into "the message". Each of those is a defensible
 * dictionary translation and a theological loss. Implementations are expected
 * to carry a glossary and to be told they are translating a conversation
 * about Christian faith.
 */

export interface TranslationRequest {
  readonly text: string;
  readonly from: LanguageCode;
  readonly to: LanguageCode;
  /**
   * Recent turns, oldest first, so pronouns and ellipsis resolve correctly.
   * "Do you believe that?" is untranslatable without the preceding line.
   */
  readonly context?: readonly string[];
  readonly signal?: AbortSignal;
}

export interface TranslationResult {
  readonly text: string;
  readonly from: LanguageCode;
  readonly to: LanguageCode;
  /** Engine identifier recorded on the message for auditing. */
  readonly engine: string;
  readonly confidence: number;
  /**
   * Terms the engine treated as religious vocabulary, with the reading it
   * chose. Surfaced to volunteers so they can see when a loaded word was
   * involved, and to admins reviewing a conversation that went wrong.
   */
  readonly glossaryHits: readonly GlossaryHit[];
}

export interface GlossaryHit {
  readonly sourceTerm: string;
  readonly renderedAs: string;
  readonly note?: string;
}

export interface LanguageDetectionResult {
  readonly language: LanguageCode;
  readonly confidence: number;
}

export interface Translator {
  readonly name: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
  detectLanguage(text: string, signal?: AbortSignal): Promise<LanguageDetectionResult>;
}

/**
 * A term whose Christian reading differs from its everyday one.
 *
 * `senses` is keyed by language tag. A missing entry means "no special
 * handling for this language", which is honest rather than harmful.
 */
export interface GlossaryEntry {
  readonly term: string;
  /** What the word means here, in English, for the model's benefit. */
  readonly christianSense: string;
  /** The mistranslation this entry exists to prevent. */
  readonly avoid?: string;
  readonly senses: Readonly<Record<LanguageCode, string>>;
}

export interface Glossary {
  readonly entries: readonly GlossaryEntry[];
  /** Entries whose term appears in the given text, for prompt narrowing. */
  match(text: string): readonly GlossaryEntry[];
}
