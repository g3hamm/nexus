import { z } from "zod";
import type { LanguageCode } from "./language.js";

/**
 * A scripture reference, normalized.
 *
 * `book` is an OSIS-style identifier ("John", "1Cor", "Ps") so that lookups
 * are translation- and language-independent. Detecting "Juan 3:16" in Spanish
 * and "John 3:16" in English must produce the same reference.
 */
export interface VerseReference {
  readonly book: string;
  readonly chapter: number;
  readonly verse: number | null;
  /** Set for ranges like John 3:16-18. */
  readonly endVerse: number | null;
}

export const verseReferenceSchema = z.object({
  book: z.string().min(1),
  chapter: z.number().int().min(1),
  verse: z.number().int().min(1).nullable(),
  endVerse: z.number().int().min(1).nullable(),
});

/** A reference as found inside a message, with its position for hover targeting. */
export interface DetectedReference {
  readonly reference: VerseReference;
  /** Exactly the text that matched, so the UI can underline it in place. */
  readonly matchedText: string;
  readonly startIndex: number;
  readonly endIndex: number;
}

export interface Passage {
  readonly reference: VerseReference;
  readonly language: LanguageCode;
  /** Short code of the translation this text came from, e.g. "WEB", "KJV". */
  readonly translationId: string;
  readonly translationName: string;
  readonly verses: readonly PassageVerse[];
  /** Required attribution text, where the source demands it. */
  readonly copyright: string | null;
}

export interface PassageVerse {
  readonly verse: number;
  readonly text: string;
}

export function formatReference(ref: VerseReference): string {
  const base = `${ref.book} ${ref.chapter}`;
  if (ref.verse === null) return base;
  if (ref.endVerse !== null && ref.endVerse !== ref.verse) {
    return `${base}:${ref.verse}-${ref.endVerse}`;
  }
  return `${base}:${ref.verse}`;
}

export function sameReference(a: VerseReference, b: VerseReference): boolean {
  return (
    a.book === b.book &&
    a.chapter === b.chapter &&
    a.verse === b.verse &&
    a.endVerse === b.endVerse
  );
}
