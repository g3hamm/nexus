"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The volunteer's two halves: the conversation, and the panel beside it.
 *
 * On a wide screen they sit side by side, which is what the work actually
 * wants — reading a suggested passage while a reply is half-typed.
 *
 * On a phone there is no room for that, so the two become pages of one
 * horizontally-snapping scroller and the volunteer swipes between them. Native
 * scroll-snap rather than a gesture library: it inherits real momentum, works
 * with a trackpad, survives a screen reader, and adds nothing to the bundle.
 *
 * Both halves are rendered **once**, into one DOM tree that changes shape at
 * the breakpoint. Rendering a mobile copy and a desktop copy would be simpler
 * to write and would quietly open two realtime connections and two polling
 * loops for the same conversation.
 */
export function VolunteerWorkspace({
  conversation,
  panel,
  panelLabel,
}: {
  readonly conversation: ReactNode;
  readonly panel: ReactNode;
  /** What the second page is called. Differs for a practice session. */
  readonly panelLabel: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const go = useCallback((index: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }, []);

  // Follows the scroll rather than driving it, so a swipe and a tap on the
  // tabs cannot disagree about which page is showing.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (el.clientWidth === 0) return;
        setPage(el.scrollLeft > el.clientWidth / 2 ? 1 : 0);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/*
        A swipe nobody knows about is a feature nobody uses, so the two pages
        are named. Hidden on desktop, where both are simply visible.
      */}
      <div
        role="tablist"
        aria-label="Conversation and support"
        className="border-line flex shrink-0 gap-1 border-b px-4 pt-3 lg:hidden"
      >
        <Tab selected={page === 0} onSelect={() => go(0)}>
          Conversation
        </Tab>
        <Tab selected={page === 1} onSelect={() => go(1)}>
          {panelLabel}
        </Tab>
      </div>

      <div
        ref={scroller}
        className={[
          // Full width on purpose. Capping this centred the pair and left the
          // panel floating in the middle of a wide screen with dead space
          // beside it; the conversation column has its own reading width, so
          // the room is better spent putting the panel against the edge where
          // the eye expects it.
          "flex min-h-0 w-full flex-1",
          // Phone: two pages, one per screen, snapping.
          "snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
          // Desktop: an ordinary two-column layout again.
          "lg:snap-none lg:overflow-x-visible",
        ].join(" ")}
      >
        <div className="w-full shrink-0 snap-center lg:w-auto lg:min-w-0 lg:flex-1">
          {conversation}
        </div>
        <aside
          className={[
            // The slab. It is the volunteer's instrument board, and looking
            // exactly like the conversation beside it was the problem: a
            // suggestion to weigh read as a message to answer.
            "bg-panel w-full shrink-0 snap-center overflow-y-auto",
            "lg:w-80 xl:w-96",
          ].join(" ")}
        >
          {panel}
        </aside>
      </div>
    </div>
  );
}

function Tab({
  selected,
  onSelect,
  children,
}: {
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={[
        "rounded-t-md px-3 pb-2 text-sm transition-colors",
        selected
          ? "text-ink border-accent border-b-2"
          : "text-ink-subtle hover:text-ink-muted border-b-2 border-transparent",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
