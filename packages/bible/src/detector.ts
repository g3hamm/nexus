import type { DetectedReference, LanguageCode, ReferenceDetector } from "@nexus/core";
import { ALIASES_BY_LENGTH, chaptersIn, normalise, osisFor } from "./books.js";

/**
 * Finds scripture references inside free text.
 *
 * The hard part is not the pattern, it is the false positives. "Job", "Acts",
 * "Mark", "Song" and "Judges" are ordinary English words, and a seeker writing
 * "I lost my job 3 years ago" must not have "job 3" quietly turned into a
 * scripture link. Getting that wrong is worse than missing a reference: it
 * makes the product look like it is not listening.
 *
 * So a bare chapter number is only accepted when the book name was
 * capitalised, while an explicit chapter:verse is accepted either way — nobody
 * writes "job 3:16" about employment. In scripts without letter case the
 * capitalisation test cannot help, so those rely on the verse form.
 *
 * Runs against the *original* text of every message, synchronously, so a
 * reference works in whatever language it was typed in.
 */
export class PatternReferenceDetector implements ReferenceDetector {
  readonly #pattern: RegExp;

  constructor() {
    // Longest alias first so "1 John" wins over "John".
    const alternatives = ALIASES_BY_LENGTH.map(escapeRegExp).join("|");
    this.#pattern = new RegExp(
      // book, optional trailing dot for abbreviations, chapter,
      // optional :verse, optional -endVerse
      String.raw`(?<![\p{L}\p{N}])(${alternatives})\.?\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?)?(?![\p{L}\p{N}])`,
      "giu",
    );
  }

  detect(text: string, _language: LanguageCode): readonly DetectedReference[] {
    const found: DetectedReference[] = [];
    // A fresh lastIndex per call — the regex is shared and stateful.
    this.#pattern.lastIndex = 0;

    for (const match of text.matchAll(this.#pattern)) {
      const [matched, rawBook, rawChapter, rawVerse, rawEnd] = match;
      if (!rawBook || !rawChapter || match.index === undefined) continue;

      const osis = osisFor(normalise(rawBook));
      if (!osis) continue;

      const chapter = Number(rawChapter);
      const maxChapter = chaptersIn(osis);
      // A book with 21 chapters cannot have a 40th. Rejecting this catches
      // most remaining accidents, like a year or a quantity.
      if (!Number.isFinite(chapter) || chapter < 1) continue;
      if (maxChapter !== null && chapter > maxChapter) continue;

      const verse = rawVerse ? Number(rawVerse) : null;

      // The ambiguity guard. Without a verse, insist the writer capitalised
      // the book — that is what separates "Job 3" from "my job 3 years ago".
      if (verse === null && !looksLikeATitle(rawBook)) continue;

      const endVerse = rawEnd ? Number(rawEnd) : null;
      // "John 3:18-16" is a typo, not a range. Drop the end rather than
      // producing a reference that cannot be looked up.
      const usableEnd =
        endVerse !== null && verse !== null && endVerse > verse ? endVerse : null;

      found.push({
        reference: { book: osis, chapter, verse, endVerse: usableEnd },
        matchedText: matched,
        startIndex: match.index,
        endIndex: match.index + matched.length,
      });
    }

    return found;
  }
}

/**
 * True when the first cased letter is uppercase.
 *
 * Scripts without case — Arabic, Persian, Chinese, Hebrew — have no first
 * uppercase letter, so this returns false and those references are accepted
 * only in chapter:verse form. That is a real limitation rather than a bug:
 * the alternative is a language-specific heuristic per script, and the book
 * names for those languages are not in the table yet either.
 */
function looksLikeATitle(book: string): boolean {
  for (const char of book) {
    const lower = char.toLowerCase();
    const upper = char.toUpperCase();
    if (lower === upper) continue; // not a cased letter
    return char === upper;
  }
  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const referenceDetector = new PatternReferenceDetector();
