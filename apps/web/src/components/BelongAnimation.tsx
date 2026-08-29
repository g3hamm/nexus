"use client";

import { useEffect, useMemo, useState } from "react";
import { textDirection } from "@nexus/core";

/**
 * "You belong.", typed out and then retyped in one language after another.
 *
 * Replaces the front door's old, plainer question with something that shows
 * rather than states the product's whole premise: this works in any
 * language, for anyone, before a single word has been exchanged.
 *
 * **This is a first draft, not vetted copy.** Nothing else user-facing in
 * this product ships translated text without a native speaker's pass — the
 * crisis card is hand-written in 19 languages for exactly that reason. These
 * twenty are the assistant's best-effort natural equivalent of "you belong"
 * in each, reusing the crisis card's own language list so the two agree
 * about which languages this deployment actually speaks to. Replace whatever
 * reads wrong to a native speaker; `PHRASES` is the only thing to touch.
 */
const PHRASES: readonly { readonly lang: string; readonly text: string }[] = [
  { lang: "en", text: "You belong." },
  { lang: "es", text: "Perteneces aquí." },
  { lang: "pt", text: "Você pertence aqui." },
  { lang: "fr", text: "Tu as ta place ici." },
  { lang: "de", text: "Du gehörst dazu." },
  { lang: "it", text: "Qui è il tuo posto." },
  { lang: "nl", text: "Hier hoor je thuis." },
  { lang: "pl", text: "Tu jest twoje miejsce." },
  { lang: "ru", text: "Здесь твоё место." },
  { lang: "uk", text: "Тут твоє місце." },
  { lang: "ar", text: "هنا مكانك." },
  { lang: "fa", text: "اینجا جای توست." },
  { lang: "zh", text: "你属于这里。" },
  { lang: "ja", text: "ここがあなたの居場所です。" },
  { lang: "ko", text: "여기가 당신의 자리예요." },
  { lang: "hi", text: "यहाँ आपका स्थान है।" },
  { lang: "id", text: "Di sini tempatmu." },
  { lang: "tr", text: "Burası senin yerin." },
  { lang: "vi", text: "Đây là nơi bạn thuộc về." },
  { lang: "sw", text: "Hapa ni mahali pako." },
];

const TYPE_MS = 55;
const DELETE_MS = 28;
const HOLD_MS = 1_600;
const PAUSE_MS = 350;

/**
 * Splits by user-perceived character, not by JavaScript's UTF-16 units.
 *
 * Several scripts here build one visible character from several code points
 * — a Devanagari conjunct, a Hangul syllable, a base letter plus a
 * diacritic. Slicing those apart mid-type does not break anything, but it
 * does flash a half-formed character on every single step, which is an odd
 * thing to ship in a product this careful about how its text renders.
 * `Intl.Segmenter` is not in this project's configured `lib`, hence the local
 * shape below rather than widening a shared TypeScript setting for one
 * decorative component.
 */
interface GraphemeSegmenter {
  segment(input: string): Iterable<{ segment: string }>;
}

function graphemesOf(text: string, lang: string): readonly string[] {
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (
        locale: string,
        opts: { granularity: "grapheme" },
      ) => GraphemeSegmenter;
    }
  ).Segmenter;
  if (!Segmenter) return Array.from(text);
  return Array.from(
    new Segmenter(lang, { granularity: "grapheme" }).segment(text),
    (s) => s.segment,
  );
}

/** Never animates a visitor who has told their OS they would rather it didn't. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = (matches: boolean) => setReduced(matches);
    apply(query.matches);
    const onChange = (event: MediaQueryListEvent) => apply(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function BelongAnimation() {
  const [index, setIndex] = useState(0);
  // Starts fully typed, not empty. This is what a browser with JavaScript
  // disabled, or not yet loaded, renders: a plain, true, complete sentence.
  // It is also what everyone else sees for an instant before the first
  // delete begins. Nobody on a slow connection should load this page to a
  // blank heading.
  const [count, setCount] = useState(
    () => graphemesOf(PHRASES[0]!.text, PHRASES[0]!.lang).length,
  );
  const [deleting, setDeleting] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const phrase = PHRASES[index % PHRASES.length]!;
  const chars = useMemo(
    () => graphemesOf(phrase.text, phrase.lang),
    [phrase.text, phrase.lang],
  );

  useEffect(() => {
    // A stated preference for less motion gets the plain first sentence and
    // nothing else — no cycling, no cursor, no exception.
    if (reducedMotion) return;

    const delay = deleting
      ? count > 0
        ? DELETE_MS
        : PAUSE_MS
      : count < chars.length
        ? TYPE_MS
        : HOLD_MS;

    const timer = setTimeout(() => {
      if (deleting) {
        if (count > 0) setCount((c) => c - 1);
        else {
          setDeleting(false);
          setIndex((i) => (i + 1) % PHRASES.length);
        }
      } else if (count < chars.length) {
        setCount((c) => c + 1);
      } else {
        setDeleting(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [count, deleting, chars.length, reducedMotion]);

  const shown = reducedMotion ? PHRASES[0]!.text : chars.slice(0, count).join("");

  return (
    <>
      {/* The accessible name, and it never changes. A screen reader that
          re-announced this heading on every keystroke of every language
          would make the page far worse for exactly the readers calm design
          is supposed to protect. */}
      <span className="sr-only">You belong.</span>
      <span aria-hidden="true" dir={textDirection(phrase.lang)}>
        {shown}
        {reducedMotion ? null : (
          <span
            aria-hidden="true"
            // `motion-reduce:hidden` is not redundant with the check above:
            // the server always renders as if motion were fine, since it
            // cannot know a visitor's OS setting, so this is what hides the
            // cursor during the gap between that HTML arriving and this
            // component's own effect running.
            className="bg-accent ml-1 inline-block h-[0.85em] w-[2px] translate-y-[0.1em] animate-pulse motion-reduce:hidden"
          />
        )}
      </span>
    </>
  );
}
