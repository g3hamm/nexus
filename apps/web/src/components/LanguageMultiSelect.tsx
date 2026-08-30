"use client";

import { useEffect, useRef, useState } from "react";
import { endonym, SEEKER_UI_LANGUAGES, type LanguageCode } from "@nexus/core";
import { cn } from "@nexus/ui";
import { ChevronDownIcon } from "./CornerLink";

const TRIGGER =
  "border-line bg-surface text-ink flex min-h-11 w-full flex-wrap items-center " +
  "gap-1.5 rounded-md border px-3 py-2 text-left transition-colors focus:border-accent";

/**
 * The front-door language switch's own list, turned into a multi-select — a
 * volunteer picks several languages, not one to relabel a page in.
 *
 * Reusing `SEEKER_UI_LANGUAGES` means this offers exactly the languages
 * Nexus already has UI copy for, not the open set the field actually
 * accepts: `languageCodeSchema` on the apply endpoint takes any BCP-47 tag.
 * A volunteer whose language isn't one of these twenty has no way to enter
 * it here. Accepted for now on the assumption that most applicants speak
 * one of them — an existing, already-translated list beat a second,
 * longer one nobody had reviewed, and the free-text box this replaced
 * offered no guidance on what to type in the first place.
 */
export function LanguageMultiSelect({
  id,
  value,
  onChange,
}: {
  readonly id?: string;
  readonly value: readonly LanguageCode[];
  readonly onChange: (languages: LanguageCode[]) => void;
}) {
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

  function toggle(code: LanguageCode) {
    const selected = value.includes(code);
    // The endpoint requires at least one language; leaving the last one
    // checked is simpler than surfacing a validation error for it.
    if (selected && value.length === 1) return;
    onChange(selected ? value.filter((v) => v !== code) : [...value, code]);
  }

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={TRIGGER}
      >
        {value.length > 0 ? (
          value.map((code) => (
            <span
              key={code}
              dir="auto"
              className="bg-surface-sunken rounded px-1.5 py-0.5 text-sm"
            >
              {endonym(code)}
            </span>
          ))
        ) : (
          <span className="text-ink-subtle text-sm">Select languages</span>
        )}
        <ChevronDownIcon className="text-ink-subtle ml-auto" />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="border-line bg-surface shadow-lifted absolute start-0 top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border py-1 text-sm"
        >
          {SEEKER_UI_LANGUAGES.map((code) => {
            const selected = value.includes(code);
            return (
              <li key={code} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  dir="auto"
                  onClick={() => toggle(code)}
                  className={cn(
                    "hover:bg-surface-sunken flex w-full items-center justify-between px-3 py-1.5 text-start",
                    selected ? "text-ink font-medium" : "text-ink-muted",
                  )}
                >
                  {endonym(code)}
                  {selected ? <CheckIcon /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-3.5 shrink-0"
    >
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}
