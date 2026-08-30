"use client";

import type { CoverageState } from "@nexus/core";
import { useUiLanguage } from "./LanguageProvider";

/**
 * The tagline and the honesty line beneath it, in whichever language the
 * seeker has chosen. See `LanguageProvider` and `SEEKER_UI_STRINGS`.
 *
 * `dir="auto"` rather than a direction threaded down from context: each of
 * these is one short, self-contained string, and the Unicode bidi algorithm
 * reads its own first strong character correctly on its own. Nothing here
 * needs to know the language is Arabic — it only needs to look at the text.
 */
export function FrontDoorTagline({
  coverage,
}: {
  readonly coverage: CoverageState | null;
}) {
  const { strings } = useUiLanguage();

  const coverageLine = (() => {
    switch (coverage) {
      case "open":
        return strings.coverageOpen;
      case "busy":
        return strings.coverageBusy;
      case "closed":
        return strings.coverageClosed;
      case null:
        return strings.coverageUnknown;
    }
  })();

  return (
    <>
      <p dir="auto" className="text-ink mt-4 text-balance text-center text-lg">
        {strings.tagline}
      </p>
      <p dir="auto" className="text-ink-subtle mt-1.5 text-balance text-center text-sm">
        {coverageLine}
      </p>
    </>
  );
}

/** "No account. No email. Nothing to sign up for." — see `FrontDoorTagline` above. */
export function NoAccountLine() {
  const { strings } = useUiLanguage();
  return (
    <p dir="auto" className="text-ink-subtle mt-6 text-center text-sm">
      {strings.noAccountLine}
    </p>
  );
}
