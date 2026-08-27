/**
 * @nexus/bible — scripture lookup and in-message reference detection.
 *
 * SCAFFOLD. The contracts are settled; the implementations are wave two.
 *
 * The decided design, so whoever picks this up is not re-deciding it:
 *
 *   - `BundledBibleProvider` reads public-domain text (World English Bible,
 *     KJV, and PD translations in other languages) from files shipped with the
 *     app. No API key, no network hop, no licensing exposure, works offline.
 *     This is the floor: scripture lookup must never fail because a third
 *     party is down.
 *   - `ApiBibleProvider` wraps scripture.api.bible for the long tail — 2,500+
 *     versions across 1,600+ languages. Requires API_BIBLE_KEY, and each
 *     version carries its own attribution and usage restrictions, which
 *     `TranslationInfo.copyright` exists to carry through to the UI.
 *   - `CompositeBibleProvider` tries the remote catalogue and falls back to
 *     bundled text, so a missing key degrades coverage instead of breaking
 *     the feature.
 *
 * Copyrighted translations (NIV, ESV, NASB) must not be added to the bundled
 * set. They are licensed per-translation and per-use; see
 * docs/adr/0006-bible-text-sources.md.
 */
import type {
  BibleProvider,
  DetectedReference,
  LanguageCode,
  LookupOptions,
  Passage,
  ReferenceDetector,
  TranslationInfo,
  VerseReference,
} from "@nexus/core";
import { NexusError } from "@nexus/core";

export class BundledBibleProvider implements BibleProvider {
  readonly name = "bundled-public-domain";

  async listTranslations(_language?: LanguageCode): Promise<readonly TranslationInfo[]> {
    throw NexusError.notImplemented("BundledBibleProvider.listTranslations");
  }

  async lookup(
    _reference: VerseReference,
    _options: LookupOptions,
  ): Promise<Passage | null> {
    throw NexusError.notImplemented("BundledBibleProvider.lookup");
  }
}

/**
 * Detects references like "John 3:16", "Juan 3:16", "1 Cor 13", "요한복음 3:16".
 *
 * Runs against the *original* text of every message, not a translation, so a
 * reference keeps working in the language it was typed in. Must stay
 * synchronous and cheap — it is on the path of every single message.
 */
export class PatternReferenceDetector implements ReferenceDetector {
  detect(_text: string, _language: LanguageCode): readonly DetectedReference[] {
    throw NexusError.notImplemented("PatternReferenceDetector.detect");
  }
}
