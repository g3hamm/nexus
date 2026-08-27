import type {
  BibleProvider,
  LanguageCode,
  LookupOptions,
  Passage,
  TranslationInfo,
  VerseReference,
} from "@nexus/core";
import { NexusError, formatReference } from "@nexus/core";
import { englishName } from "./books.js";

const BASE = "https://api.scripture.api.bible/v1";

/**
 * scripture.api.bible — the long tail.
 *
 * Thousands of versions across most of the languages Nexus actually needs,
 * which self-hosted public-domain text does not begin to cover. Requires a key,
 * and each version carries its own attribution and usage restrictions, which is
 * why `copyright` is carried through to the UI rather than dropped.
 */
export class ApiBibleProvider implements BibleProvider {
  readonly name = "api.bible";
  readonly #apiKey: string;
  #catalogue: readonly (TranslationInfo & { apiId: string })[] | null = null;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new NexusError(
        "provider_unavailable",
        "API_BIBLE_KEY is required for the API.Bible provider.",
      );
    }
    this.#apiKey = apiKey;
  }

  async listTranslations(language?: LanguageCode): Promise<readonly TranslationInfo[]> {
    const catalogue = await this.#loadCatalogue();
    if (!language) return catalogue;
    const primary = language.split("-")[0]?.toLowerCase();
    return catalogue.filter((t) => t.language.split("-")[0]?.toLowerCase() === primary);
  }

  async lookup(
    reference: VerseReference,
    options: LookupOptions,
  ): Promise<Passage | null> {
    const catalogue = await this.#loadCatalogue();
    const primary = options.language.split("-")[0]?.toLowerCase();

    const chosen =
      catalogue.find((t) => t.id === options.translationId) ??
      catalogue.find((t) => t.language.split("-")[0]?.toLowerCase() === primary);
    if (!chosen) return null;

    // API.Bible uses its own passage ids: BOOK.CHAPTER.VERSE, with USFM book
    // codes. OSIS and USFM agree closely enough for the canonical books that
    // an uppercase OSIS id resolves correctly.
    const usfm = reference.book.toUpperCase();
    const passageId =
      reference.verse === null
        ? `${usfm}.${reference.chapter}`
        : reference.endVerse !== null
          ? `${usfm}.${reference.chapter}.${reference.verse}-${usfm}.${reference.chapter}.${reference.endVerse}`
          : `${usfm}.${reference.chapter}.${reference.verse}`;

    const response = await this.#get(
      `/bibles/${chosen.apiId}/passages/${passageId}` +
        `?content-type=text&include-notes=false&include-titles=false&include-verse-numbers=false`,
      options.signal,
    );
    if (!response) return null;

    const body = response as {
      data?: { content?: string; copyright?: string };
    };
    const content = body.data?.content?.trim();
    if (!content) return null;

    return {
      reference,
      language: chosen.language,
      translationId: chosen.id,
      translationName: chosen.name,
      // The API returns the passage as prose rather than per verse. Splitting
      // it into fake verse numbers would misattribute text, so the whole
      // passage is returned as one entry numbered from its start.
      verses: [{ verse: reference.verse ?? 1, text: content }],
      copyright: body.data?.copyright ?? chosen.copyright,
    };
  }

  async #loadCatalogue() {
    if (this.#catalogue) return this.#catalogue;

    const response = await this.#get("/bibles");
    const body = response as {
      data?: {
        id: string;
        abbreviation?: string;
        name: string;
        language?: { id?: string };
        copyright?: string;
      }[];
    };

    this.#catalogue = (body.data ?? []).map((b) => ({
      apiId: b.id,
      id: b.abbreviation ?? b.id,
      name: b.name,
      language: b.language?.id ?? "en",
      // Everything here is licensed by its publisher, whatever its age.
      publicDomain: false,
      copyright: b.copyright ?? null,
    }));
    return this.#catalogue;
  }

  async #get(path: string, signal?: AbortSignal): Promise<unknown | null> {
    const response = await fetch(`${BASE}${path}`, {
      headers: { "api-key": this.#apiKey },
      ...(signal ? { signal } : {}),
    });

    // A missing passage is an ordinary answer, not a failure.
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new NexusError(
        "provider_unavailable",
        `API.Bible responded ${response.status}`,
      );
    }
    return response.json();
  }
}

/** Used in error messages and logs, where an OSIS id is unhelpful. */
export function describeReference(reference: VerseReference): string {
  return `${englishName(reference.book)} ${formatReference(reference).split(" ").slice(1).join(" ")}`;
}
