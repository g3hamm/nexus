"use client";

import { useEffect, useRef, useState } from "react";
import { endonym, SEEKER_UI_LANGUAGES } from "@nexus/core";
import { cn } from "@nexus/ui";
import { ChevronDownIcon, CORNER_PILL_CLASS } from "./CornerLink";
import { useUiLanguage } from "./LanguageProvider";

/**
 * Lets a seeker relabel the page before they have written a single word.
 *
 * An endonym pill, not a flag. A flag names a country, and this page needs a
 * language — the two are not the same question. Arabic alone is an official
 * language in more than twenty countries; a flag would have to guess which
 * one to show a seeker on a borrowed phone, behind a VPN, or simply abroad,
 * and for a contested border it would be guessing at something this ministry
 * has no reason to take a position on. A language's own name, in its own
 * script, is the one label that is never wrong and never a political choice.
 *
 * This only relabels the page. Choosing one here does not set
 * `seekerLanguage` and does not stop anyone writing their real message in a
 * completely different language — that is still detected from the message
 * itself, exactly as before this existed.
 */
export function LanguageSwitch() {
  const { language, setLanguage } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent): void {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="fixed start-5 top-5">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        dir="auto"
        className={CORNER_PILL_CLASS}
      >
        {endonym(language)}
        <ChevronDownIcon />
      </button>

      {open ? (
        <ul
          role="menu"
          className="border-line bg-surface shadow-lifted absolute start-0 top-full z-20 mt-1 max-h-72 w-44 overflow-y-auto rounded-lg border py-1 text-sm"
        >
          {SEEKER_UI_LANGUAGES.map((code) => (
            <li key={code} role="none">
              <button
                type="button"
                role="menuitem"
                dir="auto"
                onClick={() => {
                  setLanguage(code);
                  setOpen(false);
                }}
                className={cn(
                  "hover:bg-surface-sunken block w-full px-3 py-1.5 text-start",
                  code === language ? "text-ink font-medium" : "text-ink-muted",
                )}
              >
                {endonym(code)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
