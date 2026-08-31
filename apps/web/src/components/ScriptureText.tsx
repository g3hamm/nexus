"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/** Matches the width class on the card; the two have to agree to centre it. */
const CARD_WIDTH = 320;
/** Below this there is not enough of a passage visible to be worth opening. */
const MIN_CARD_HEIGHT = 140;
const MARGIN = 16;
/** Between the reference and the card pointing at it. */
const OFFSET = 8;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

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
  linkClassName,
}: {
  readonly text: string;
  readonly language: string;
  readonly className?: string;
  /**
   * Colour for the reference itself. The default is tuned for the page; the
   * volunteer's dark panel passes its own, where the page accent does not
   * have the contrast to be read.
   */
  readonly linkClassName?: string;
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
        linkClassName={linkClassName}
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
  linkClassName,
}: {
  readonly label: string;
  readonly reference: {
    book: string;
    chapter: number;
    verse: number | null;
    endVerse: number | null;
  };
  readonly language: string;
  readonly linkClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [loading, setLoading] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{
    left: number;
    below: boolean;
    /** The edge the card is pinned by — `top` below, `bottom` above. */
    offset: number;
    maxHeight: number;
  } | null>(null);

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

  /**
   * Where the card should sit, in viewport coordinates.
   *
   * Whichever side has more room, and never taller than that room. This used
   * to guess the height at a fixed 220px and then pull the card up by its own
   * full height — so a long passage, which can run to 60% of the screen, was
   * dragged clean off the top and the first verses could not be read at all.
   *
   * The fix is to stop guessing twice. The card is pinned by the edge nearest
   * the reference — `top` when it opens downwards, `bottom` when it opens
   * upwards — so it grows away from the reference into space already measured,
   * and `maxHeight` caps it at exactly that space. Nothing has to know the
   * rendered height, and neither edge can leave the screen.
   */
  const place = useCallback(() => {
    const el = trigger.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const width = Math.min(CARD_WIDTH, window.innerWidth - 2 * MARGIN);

    const roomAbove = rect.top - OFFSET - MARGIN;
    const roomBelow = window.innerHeight - rect.bottom - OFFSET - MARGIN;
    const below = roomBelow >= roomAbove;
    const room = below ? roomBelow : roomAbove;

    setAt({
      left: clamp(
        rect.left + rect.width / 2 - width / 2,
        MARGIN,
        Math.max(MARGIN, window.innerWidth - width - MARGIN),
      ),
      below,
      offset: below
        ? rect.bottom + OFFSET
        : window.innerHeight - rect.top + OFFSET,
      // A floor as well as a cap: on a short screen with the keyboard up,
      // the better side can still be small, and a card too short to show
      // anything is worse than one that overlaps the reference a little.
      maxHeight: Math.max(MIN_CARD_HEIGHT, room),
    });
  }, []);

  function show() {
    place();
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

  // The card is fixed to the viewport, so it has to be told when the thing it
  // is pointing at moves. Capture phase, because the transcript that scrolls
  // is an inner element and a scroll there does not bubble.
  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, place]);

  return (
    <span className="inline-block">
      <button
        ref={trigger}
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
        className={
          linkClassName ??
          "text-accent decoration-accent/40 hover:decoration-accent underline decoration-dotted underline-offset-2 transition-colors"
        }
      >
        {label}
      </button>

      {open && at
        ? createPortal(
            /*
              In a portal, fixed to the viewport.
              
              It used to be absolutely positioned beside the reference, which
              put it inside the transcript — and a scroll container clips its
              children on both axes, so a card next to a message near the right
              edge was sliced off mid-sentence and left a stray horizontal
              scrollbar under the conversation. Nothing can clip it from out
              here.
            */
            <span
              role="tooltip"
              style={{
                left: at.left,
                ...(at.below ? { top: at.offset } : { bottom: at.offset }),
                maxHeight: at.maxHeight,
              }}
              className="border-line bg-surface shadow-lifted fixed z-50 block w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-lg border p-3 text-left text-sm font-normal"
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
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
