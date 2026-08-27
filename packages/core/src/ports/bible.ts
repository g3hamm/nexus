import type { LanguageCode } from "../domain/language.js";
import type { DetectedReference, Passage, VerseReference } from "../domain/scripture.js";

/**
 * Scripture lookup.
 *
 * Two implementations are expected to coexist: a bundled public-domain set
 * that always works and carries no licensing risk, and an optional remote
 * catalogue with far wider language coverage. A composite provider tries the
 * remote one and falls back, so a missing API key degrades coverage rather
 * than breaking the feature.
 */

export interface TranslationInfo {
  /** Short code, e.g. "WEB". */
  readonly id: string;
  readonly name: string;
  readonly language: LanguageCode;
  /** True when the text is public domain and can be stored and shown freely. */
  readonly publicDomain: boolean;
  readonly copyright: string | null;
}

export interface LookupOptions {
  /** Preferred reading language. The provider picks the best available match. */
  readonly language: LanguageCode;
  /** Force a specific translation, overriding language preference. */
  readonly translationId?: string;
  readonly signal?: AbortSignal;
}

export interface BibleProvider {
  readonly name: string;

  listTranslations(language?: LanguageCode): Promise<readonly TranslationInfo[]>;

  /** Null when the reference cannot be served in any available translation. */
  lookup(reference: VerseReference, options: LookupOptions): Promise<Passage | null>;
}

/**
 * Finds scripture references inside free text.
 *
 * Runs over the *original* text of a message, not a translation, so that a
 * reference written as "Juan 3:16" is caught in the language it was typed in.
 * Detection must be cheap and synchronous — it runs on every message.
 */
export interface ReferenceDetector {
  detect(text: string, language: LanguageCode): readonly DetectedReference[];
}
