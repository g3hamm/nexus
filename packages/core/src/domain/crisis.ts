import { CRISIS_DIRECTORY, INTERNATIONAL_DIRECTORY } from "./crisis-directory.js";
import { CRISIS_STRINGS, type CrisisStrings } from "./crisis-strings.js";

/**
 * What Nexus shows someone who may be about to hurt themselves.
 *
 * Three rules govern everything in this file, and they are the reason it
 * contains data rather than calls:
 *
 *   1. **No model, no network, no database.** This has to work when the LLM
 *      provider is down, when translation fails, and when the realtime
 *      transport has dropped. It is static data and a lookup. The worst
 *      moment in the product is the wrong moment to depend on an API.
 *   2. **Never guess a number.** A wrong helpline is worse than no helpline.
 *      Countries appear here only where the entry is verified, and every
 *      seeker — listed country or not — also gets the international
 *      directory, which is maintained by people whose job that is.
 *   3. **Nothing here is stored.** The country comes from the edge on the
 *      seeker's own request and is used to pick a list, then discarded.
 */
export interface Helpline {
  /**
   * Never translated. Someone phoning a helpline has to be able to say its
   * name, and a translated name is a name nobody at the other end knows.
   */
  readonly name: string;
  /** A number, a short code, or a texting instruction. Shown verbatim. */
  readonly contact: string;
  readonly url?: string;
  /** Hours, languages — anything that changes whether it is worth trying. */
  readonly note?: string;
}

export interface CountryCrisisResources {
  /** ISO 3166-1 alpha-2, upper case. */
  readonly country: string;
  /** What to dial for police, fire, or an ambulance. */
  readonly emergency: string;
  readonly helplines: readonly Helpline[];
  /**
   * When a human last confirmed these are current, ISO 8601 date.
   *
   * Helpline numbers change. An entry nobody has checked in two years is a
   * liability, and dating them is what makes that visible instead of silent.
   */
  readonly verifiedOn: string;
}

/** What a seeker's client renders. Already resolved for their country. */
export interface CrisisResources {
  /** Null when we have no verified entry for where they are. */
  readonly emergency: string | null;
  readonly helplines: readonly Helpline[];
  /** Always present. The floor that cannot go down. */
  readonly directory: Helpline;
  readonly strings: CrisisStrings;
}

/**
 * Resolves the resources to show, given where someone appears to be.
 *
 * `country` may be null, unknown, or wrong — a VPN, a satellite link, a
 * misconfigured edge. Every path returns something useful, and no path
 * returns a number we are not sure about.
 *
 * Countries absent from the directory are not an oversight in every case.
 * Some are deliberate: where discussing conversion carries legal risk, we
 * are not going to point someone at a state-operated line. The international
 * directory routes them without us making that call for them.
 */
export function crisisResourcesFor(
  country: string | null | undefined,
  language: string,
): CrisisResources {
  const entry = country ? CRISIS_DIRECTORY[country.toUpperCase()] : undefined;

  return {
    emergency: entry?.emergency ?? null,
    helplines: entry?.helplines ?? [],
    directory: INTERNATIONAL_DIRECTORY,
    strings: crisisStringsFor(language),
  };
}

/**
 * The card's own words, in the seeker's language.
 *
 * Hand-written rather than machine-translated, and static rather than
 * fetched, for the same reason as the numbers: this text has to render
 * instantly and correctly on the worst day, and a translation call is one
 * more thing that can be slow or down. Falls back through the base language
 * ("pt-BR" to "pt") and then to English.
 */
export function crisisStringsFor(language: string): CrisisStrings {
  const exact = CRISIS_STRINGS[language];
  if (exact) return exact;

  const base = language.split("-")[0]?.toLowerCase() ?? "";
  return CRISIS_STRINGS[base] ?? CRISIS_STRINGS.en!;
}

/** Countries with a verified entry. Exposed for tests and for the docs. */
export function countriesWithCrisisResources(): readonly string[] {
  return Object.keys(CRISIS_DIRECTORY).sort();
}

export { CRISIS_DIRECTORY, INTERNATIONAL_DIRECTORY } from "./crisis-directory.js";
export type { CrisisStrings } from "./crisis-strings.js";
