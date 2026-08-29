import type {
  BibleProvider,
  LanguageCode,
  LookupOptions,
  Passage,
  PassageVerse,
  TranslationInfo,
  VerseReference,
} from "@nexus/core";
import { sameLanguage } from "@nexus/core";

/**
 * The World English Bible, shipped with the code.
 *
 * This is the floor the whole feature stands on, and the reason it can be a
 * floor is that nothing has to happen for it to work: no API key, no outbound
 * request, no database, and no load step for whoever deploys this. Clone,
 * deploy, and scripture works. ADR 6 originally put that floor in the
 * database, which was correct about the shape and wrong about the
 * consequence — a floor that only exists after someone runs a terminal
 * command is not a floor, and for most of this project's life it was empty.
 *
 * **Why the WEB.** It is dedicated to the public domain by its publisher,
 * worldwide and without conditions, so there is no licence to breach, no
 * attribution to render and no per-use terms to read. That matters more here
 * than it looks: plenty of Bible files circulate as though they were free and
 * are not — NVI, RVR 1960, ARA and the Korean and Portuguese revisions among
 * them — and every one of those would have been an easier first choice. It is
 * also modern English rather than Jacobean, which the translation layer and
 * the seeker both benefit from.
 *
 * **It is one translation, in one language.** A Spanish speaker hovering a
 * reference gets English, labelled as English. That is worse than the right
 * answer and much better than nothing, and it is the same judgement the
 * database provider already makes. Adding languages is real work — the
 * genuinely public-domain options are mostly nineteenth-century, and choosing
 * among them is a ministry's decision — so the other two providers stay in
 * front of this one, and this one never has an opinion about them.
 */
const TRANSLATION: TranslationInfo = {
  id: "WEB",
  name: "World English Bible",
  language: "en",
  publicDomain: true,
  // Nothing is required. Said out loud because "no attribution needed" is
  // unusual enough that the next person will assume it is an oversight.
  copyright: null,
};

/** Books, then chapters, then verses. A missing verse is an empty string. */
type BundledText = Readonly<Record<string, readonly (readonly string[])[]>>;

export class BundledBibleProvider implements BibleProvider {
  readonly name = "bundled";

  /**
   * Loaded on the first lookup, never at import time.
   *
   * Four megabytes of JSON is nothing to parse once and everything to parse
   * on the cold start of a route that was only ever going to render the front
   * door. The promise itself is the cache, so concurrent first lookups share
   * one parse rather than racing to do it twice.
   */
  #text: Promise<BundledText> | null = null;

  async listTranslations(language?: LanguageCode): Promise<readonly TranslationInfo[]> {
    if (language && !sameLanguage(TRANSLATION.language, language)) return [];
    return [TRANSLATION];
  }

  async lookup(
    reference: VerseReference,
    options: LookupOptions,
  ): Promise<Passage | null> {
    // Asking for a specific translation we do not hold is a miss, not an
    // excuse to answer with a different one.
    if (options.translationId && options.translationId !== TRANSLATION.id) return null;

    const chapters = (await this.#load())[reference.book];
    const chapter = chapters?.[reference.chapter - 1];
    if (!chapter) return null;

    // No verse means the whole chapter, which is what someone writing
    // "Psalm 23" meant.
    const from = reference.verse ?? 1;
    const to = reference.verse === null ? chapter.length : (reference.endVerse ?? from);

    const verses: PassageVerse[] = [];
    for (let v = from; v <= to; v += 1) {
      const text = chapter[v - 1];
      // Empty entries are verses the WEB does not carry — several later
      // manuscripts' additions. Skipped rather than rendered blank.
      if (text) verses.push({ verse: v, text });
    }

    if (verses.length === 0) return null;

    return {
      reference,
      language: TRANSLATION.language,
      translationId: TRANSLATION.id,
      translationName: TRANSLATION.name,
      verses,
      copyright: TRANSLATION.copyright,
    };
  }

  #load(): Promise<BundledText> {
    this.#text ??= import("./data/web.json", { with: { type: "json" } }).then(
      (m) => m.default as BundledText,
    );
    return this.#text;
  }
}
