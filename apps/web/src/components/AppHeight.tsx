"use client";

import { useEffect } from "react";

/**
 * Keeps the app shell exactly as tall as the window really is.
 *
 * `100dvh` is the right answer and stays the CSS fallback, but iOS Safari
 * does not always recompute it. Leave a conversation for another tab or
 * another app and come back, and the restored page can still be laid out
 * against the viewport it had when it left — usually one Safari toolbar
 * shorter than the screen it is now on. Because every height in this app
 * resolves against `body` (see the layout), a `body` an inch too short
 * doesn't clip anything: it strands the footer in the middle of the screen
 * with bare canvas underneath, which is what a seeker mid-conversation
 * actually sees.
 *
 * So the height is measured rather than inherited, and re-measured on the
 * events iOS gets wrong. `pageshow` is the one that matters most — it is
 * the back/forward-cache restore, the "left the page and came back" case —
 * and it fires on ordinary loads too, so there is no separate path for it.
 *
 * `window.innerHeight`, not `visualViewport.height`: the latter shrinks when
 * the on-screen keyboard opens, and re-laying the whole conversation out
 * around the keyboard is a different behaviour from the one `dvh` promises.
 * This matches what `100dvh` is supposed to mean, and only fixes when it is
 * measured.
 */
export function AppHeight() {
  useEffect(() => {
    const apply = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${window.innerHeight}px`,
      );
    };

    // Orientation changes report the old size if read immediately, so this
    // one gets a second look once the browser has settled.
    const applyTwice = () => {
      apply();
      requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("pageshow", applyTwice);
    window.addEventListener("orientationchange", applyTwice);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("pageshow", applyTwice);
      window.removeEventListener("orientationchange", applyTwice);
    };
  }, []);

  return null;
}
