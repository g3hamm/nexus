"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { referenceDetector } from "@nexus/bible/detect";
import { Spinner } from "@nexus/ui";

interface Passage {
  readonly found: boolean;
  /** False when no Bible source is set up at all, rather than this one verse missing. */
  readonly reference: string;
  readonly translationName?: string;
  readonly copyright?: string | null;
  readonly verses?: { verse: number; text: string }[];
}

/**
 * Passages already fetched, kept for the life of the page.
 *
 * Scripture does not change, and the same reference is usually hovered
 * several times in a conversation about it. Module scope rather than state so
 * the cache survives a message list re-rendering.
 */
const CACHE = new Map<string, Passage>();

/**
 * Renders message text with any scripture references made interactive.
 *
 * Detection runs on the text actually being displayed, so the link appears in
 * whichever rendering the reader is looking at — a Spanish reader hovers
 * "Juan 3:16" in the Spanish text, not an English reference they cannot see.
 */
export function ScriptureText({
  text,
  language,
  className,
}: {
  readonly text: string;
  readonly language: string;
  readonly className?: string;
}) {
  const detected = referenceDetector.detect(text, language);
  if (detected.length === 0) return <span className={className}>{text}</span>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  detected.forEach((found, index) => {
    if (found.startIndex > cursor) {
      parts.push(text.slice(cursor, found.startIndex));
    }
    parts.push(
      <VerseLink
        key={`${found.startIndex}-${index}`}
        label={found.matchedText}
        reference={found.reference}
        language={language}
      />,
    );
    cursor = found.endIndex;
  });

  if (cursor < text.length) parts.push(text.slice(cursor));

  return <span className={className}>{parts}</span>;
}

function VerseLink({
  label,
  reference,
  language,
}: {
  readonly label: string;
  readonly reference: {
    book: string;
    chapter: number;
    verse: number | null;
    endVerse: number | null;
  };
  readonly language: string;
}) {
  const [open, setOpen] = useState(false);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [loading, setLoading] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cacheKey = `${language}:${reference.book}.${reference.chapter}.${reference.verse ?? ""}.${reference.endVerse ?? ""}`;

  const load = useCallback(async () => {
    const cached = CACHE.get(cacheKey);
    if (cached) {
      setPassage(cached);
      return;
    }

    setLoading(true);
    try {
      const url = new URL("/api/bible/lookup", window.location.origin);
      url.searchParams.set("book", reference.book);
      url.searchParams.set("chapter", String(reference.chapter));
      if (reference.verse !== null)
        url.searchParams.set("verse", String(reference.verse));
      if (reference.endVerse !== null) {
        url.searchParams.set("endVerse", String(reference.endVerse));
      }
      url.searchParams.set("language", language);

      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error("lookup failed");

      const body = (await response.json()) as Passage;
      CACHE.set(cacheKey, body);
      setPassage(body);
    } catch {
      setPassage({ found: false, reference: label });
    } finally {
      setLoading(false);
    }
  }, [cacheKey, label, language, reference]);

  function show() {
    setOpen(true);
    void load();
  }

  // A short delay so passing the cursor over a reference on the way somewhere
  // else does not fire a request or flash a card.
  function onEnter() {
    hoverTimer.current = setTimeout(show, 350);
  }

  function onLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpen(false);
  }

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={show}
        onBlur={() => setOpen(false)}
        // Double-click and tap, for touch devices and for anyone who would
        // rather commit to opening it than have it appear under the cursor.
        onDoubleClick={show}
        onClick={(e) => {
          // A single tap on touch has no hover to precede it.
          if (e.detail === 0 || window.matchMedia("(hover: none)").matches) show();
        }}
        aria-expanded={open}
        className="text-accent decoration-accent/40 hover:decoration-accent underline decoration-dotted underline-offset-2 transition-colors"
      >
        {label}
      </button>

      {open ? (
        <span
          role="tooltip"
          // Width is clamped to the viewport, not just to a breakpoint: a
          // reference near the edge of a narrow screen pushed a fixed-width
          // card off the side, where the passage could not be read at all.
          className="border-line bg-surface shadow-lifted absolute bottom-full left-1/2 z-20 mb-2 block w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border p-3 text-left text-sm font-normal"
        >
          {loading && !passage ? (
            <span className="flex justify-center py-2">
              <Spinner className="text-ink-subtle" />
            </span>
          ) : passage?.found ? (
            <>
              <span className="text-ink-subtle block text-xs">
                {passage.reference}
                {passage.translationName ? ` · ${passage.translationName}` : ""}
              </span>
              <span dir="auto" className="text-ink mt-1.5 block leading-relaxed">
                {passage.verses?.map((v) => (
                  <span key={v.verse}>
                    {passage.verses!.length > 1 ? (
                      <sup className="text-ink-subtle mr-0.5">{v.verse}</sup>
                    ) : null}
                    {v.text}{" "}
                  </span>
                ))}
              </span>
              {passage.copyright ? (
                <span className="text-ink-subtle mt-2 block text-xs">
                  {passage.copyright}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-ink-muted block">
              {`No text is available for ${passage?.reference ?? label} in this language yet.`}
            </span>
          )}
        </span>
      ) : null}
    </span>
  );
}
