import type {
  BibleProvider,
  LanguageCode,
  LookupOptions,
  Passage,
  TranslationInfo,
  VerseReference,
} from "@nexus/core";

/**
 * Tries each provider in turn and takes the first real answer.
 *
 * Ordered widest-coverage first, self-hosted last. That way a seeker reading
 * Tagalog gets the remote catalogue when it is available, and everybody still
 * gets something when it is not. A provider that throws is skipped rather than
 * failing the lookup — losing coverage is much better than losing the feature.
 */
export class CompositeBibleProvider implements BibleProvider {
  readonly name = "composite";
  readonly #providers: readonly BibleProvider[];

  constructor(providers: readonly BibleProvider[]) {
    this.#providers = providers.filter(Boolean);
  }

  async listTranslations(language?: LanguageCode): Promise<readonly TranslationInfo[]> {
    const all: TranslationInfo[] = [];
    for (const provider of this.#providers) {
      try {
        all.push(...(await provider.listTranslations(language)));
      } catch {
        // Skip a provider that cannot answer.
      }
    }
    // First listing of an id wins, matching lookup order.
    const seen = new Set<string>();
    return all.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  }

  async lookup(
    reference: VerseReference,
    options: LookupOptions,
  ): Promise<Passage | null> {
    for (const provider of this.#providers) {
      try {
        const passage = await provider.lookup(reference, options);
        if (passage) return passage;
      } catch {
        // Try the next one. A remote outage must not remove scripture from
        // the product when we are holding a copy ourselves.
      }
    }
    return null;
  }
}
