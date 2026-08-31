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
 * It follows `visualViewport` where there is one, which is what makes the
 * composer reachable with the keyboard up. `window.innerHeight` does not
 * shrink for a keyboard — that is the whole reason the layout viewport is a
 * separate thing — so an app shell sized by it keeps its full height while a
 * phone shows perhaps half of it, and everything pinned to the bottom of the
 * shell, the message box included, sits underneath the keys. Nothing can
 * scroll it back into view either: the shell is a definite height, so there
 * is no page scroll to do it with.
 *
 * Pinch-zoom shrinks the visual viewport too, and re-laying the page out
 * because somebody zoomed in would be absurd — so a scale above 1 falls back
 * to the layout viewport, which zooming does not change.
 */
export function AppHeight() {
  useEffect(() => {
    const apply = () => {
      const vv = window.visualViewport;
      const zoomed = vv ? vv.scale > 1.01 : false;
      const height = vv && !zoomed ? vv.height : window.innerHeight;

      document.documentElement.style.setProperty("--app-height", `${height}px`);
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

    // The visual viewport has its own events, and they are the only ones a
    // keyboard opening fires — `window`'s resize does not run for it on iOS.
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);

    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("pageshow", applyTwice);
      window.removeEventListener("orientationchange", applyTwice);
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
    };
  }, []);

  return null;
}
