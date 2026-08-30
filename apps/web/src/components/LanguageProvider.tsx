"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  SEEKER_UI_LANGUAGES,
  seekerUiStringsFor,
  type LanguageCode,
  type SeekerUiStrings,
} from "@nexus/core";

const STORAGE_KEY = "nexus:ui-language";

interface LanguageContextValue {
  readonly language: LanguageCode;
  readonly strings: SeekerUiStrings;
  setLanguage(language: LanguageCode): void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * The first of the seeker's own languages that this page can relabel itself
 * in, or null if none match.
 *
 * `navigator.language`, not geo-IP. Country and language are different
 * questions — Arabic alone is an official language in more than twenty
 * countries, a browser set to French tells you what to show a Nigerian
 * exchange student in Beijing as reliably as it does anyone at home, and
 * none of this requires a request to leave the device. `countryFor()` in
 * `server/geo.ts` exists for a genuinely different job — routing to the
 * right national helpline once someone is already in a crisis — and stays
 * exactly as narrow as it is today.
 */
function detectLanguage(): LanguageCode | null {
  if (typeof navigator === "undefined") return null;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const primary = tag?.split("-")[0]?.toLowerCase();
    if (primary && SEEKER_UI_LANGUAGES.includes(primary)) return primary;
  }
  return null;
}

/**
 * Which language the front door's own words are shown in.
 *
 * English on the server and on first paint — nothing here depends on the
 * client to render correctly, same reasoning as `BelongAnimation`. Right
 * after hydration this quietly switches to a language the seeker chose on an
 * earlier visit, or failing that one their browser already reports, so
 * returning is one thing fewer to redo. Either way this is a reading aid: it
 * relabels the form and nothing else. It never sets `seekerLanguage`, and it
 * never stops anyone writing their actual message in a completely different
 * language, which is still detected from the message itself.
 */
export function LanguageProvider({ children }: { readonly children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // A private window or a disabled store just means asking again next visit.
    }

    if (saved && SEEKER_UI_LANGUAGES.includes(saved)) {
      setLanguageState(saved);
      return;
    }

    const detected = detectLanguage();
    if (detected) setLanguageState(detected);
  }, []);

  function setLanguage(next: LanguageCode): void {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Same as above — the choice just does not survive a reload.
    }
  }

  const value: LanguageContextValue = {
    language,
    strings: seekerUiStringsFor(language),
    setLanguage,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useUiLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useUiLanguage() must be used inside a LanguageProvider");
  }
  return context;
}
