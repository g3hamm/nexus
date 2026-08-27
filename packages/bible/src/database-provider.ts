import { and, asc, eq, gte, lte } from "drizzle-orm";
import type {
  BibleProvider,
  LanguageCode,
  LookupOptions,
  Passage,
  TranslationInfo,
  VerseReference,
} from "@nexus/core";
import { sameLanguage } from "@nexus/core";
import type { NexusDatabase } from "@nexus/db";
import { schema } from "@nexus/db";

const { bibleTranslations, bibleVerses } = schema;

/**
 * Scripture from our own database.
 *
 * This is the floor the whole feature stands on: it needs no API key, makes no
 * outbound request, and cannot fail because someone else's service is down.
 * Whatever else is configured, a lookup that this can serve is served.
 */
export class DatabaseBibleProvider implements BibleProvider {
  readonly name = "self-hosted";
  readonly #db: NexusDatabase;

  constructor(db: NexusDatabase) {
    this.#db = db;
  }

  async listTranslations(language?: LanguageCode): Promise<readonly TranslationInfo[]> {
    const rows = await this.#db.select().from(bibleTranslations);
    const mapped = rows.map((row): TranslationInfo => ({
      id: row.id,
      name: row.name,
      language: row.language,
      publicDomain: row.publicDomain,
      copyright: row.copyright,
    }));
    return language ? mapped.filter((t) => sameLanguage(t.language, language)) : mapped;
  }

  async lookup(
    reference: VerseReference,
    options: LookupOptions,
  ): Promise<Passage | null> {
    const translation = await this.#chooseTranslation(options);
    if (!translation) return null;

    const predicates = [
      eq(bibleVerses.translationId, translation.id),
      eq(bibleVerses.book, reference.book),
      eq(bibleVerses.chapter, reference.chapter),
    ];

    // A reference with no verse means the whole chapter, which is what
    // someone writing "Psalm 23" meant.
    if (reference.verse !== null) {
      predicates.push(gte(bibleVerses.verse, reference.verse));
      predicates.push(lte(bibleVerses.verse, reference.endVerse ?? reference.verse));
    }

    const rows = await this.#db
      .select({ verse: bibleVerses.verse, text: bibleVerses.text })
      .from(bibleVerses)
      .where(and(...predicates))
      .orderBy(asc(bibleVerses.verse));

    if (rows.length === 0) return null;

    return {
      reference,
      language: translation.language,
      translationId: translation.id,
      translationName: translation.name,
      verses: rows,
      copyright: translation.copyright,
    };
  }

  /**
   * Picks the translation to answer in.
   *
   * An explicit request wins. Otherwise the reader's own language, and only
   * then anything at all — showing a passage in a language someone cannot read
   * is better than showing nothing, and the UI labels which translation it is.
   */
  async #chooseTranslation(options: LookupOptions) {
    if (options.translationId) {
      const rows = await this.#db
        .select()
        .from(bibleTranslations)
        .where(eq(bibleTranslations.id, options.translationId))
        .limit(1);
      return rows[0] ?? null;
    }

    const all = await this.#db.select().from(bibleTranslations);
    return all.find((t) => sameLanguage(t.language, options.language)) ?? all[0] ?? null;
  }
}
