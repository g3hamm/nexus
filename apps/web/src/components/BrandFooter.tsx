"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@nexus/ui";

/**
 * Attribution, at the foot of every page — a dark strip, not a floating mark.
 *
 * The bar and the mark deliberately swap which one is dark and which one is
 * light depending on the colour scheme, rather than sharing one fixed dark
 * colour: `bg-ink` for the bar (near-black on a light page, near-cream on a
 * dark one) and `bg-canvas` for the mark (the opposite). `ink` and `canvas`
 * are already the pair this whole product uses to guarantee text reads
 * against its background, so reusing them here guarantees the same thing for
 * a bar that otherwise had no built-in reason to contrast with the page
 * sitting right above it — a fixed dark bar looked bold against a light page
 * but nearly vanished against a dark one, since both were close to the same
 * near-black.
 *
 * The mark itself is drawn as a solid shape rather than shown as its own
 * image: the supplied asset is a fairly dark grey, which is illegible on
 * *any* dark surface, this bar included — the earlier `dark:invert` was
 * built on the opposite assumption. A CSS mask reads only the file's alpha
 * channel (its shape) and paints it in a solid colour, so the mark is always
 * exactly as light or dark as whatever it needs to sit on — no dependence on
 * what tone the source asset happens to be.
 *
 * One route breaks the invert-with-theme rule on purpose. The volunteer's
 * live conversation has its own dark instrument panel running the full
 * height of the sidebar (`VolunteerWorkspace`), which never inverts with
 * light or dark mode — it is built to stay a fixed, always-dark surface no
 * matter the page's own colour scheme. A footer inverting to match the
 * *page* directly underneath a panel that never does left a visible seam in
 * light mode and would have been far worse in dark mode — a light footer
 * under a panel that stayed dark. On that one route the footer borrows the
 * panel's own colours instead of the page's, so the two read as one
 * continuous surface in both colour schemes. `usePathname` rather than a
 * prop because the footer is rendered once, in the root layout, several
 * levels above the page that actually knows it has a panel.
 *
 * Deliberately quiet, and the mark alone. This is a credit line, not a
 * masthead: nobody arrives at this product to find out who made it, and a
 * seeker least of all. It is a real link, and opens in a new tab on purpose
 * — a seeker or a volunteer mid-conversation who taps it should find the
 * ministry's site, not lose their place in a chat.
 */
/**
 * Whether the on-screen keyboard is currently covering part of the page.
 *
 * `visualViewport` is the only thing that knows: the layout viewport does
 * not shrink for the keyboard, which is exactly why the page keeps its full
 * height while a phone shows perhaps half of it. The gap between the two is
 * the keyboard.
 *
 * The threshold is deliberately generous. Browser chrome sliding in and out
 * moves this by a few dozen pixels and must not read as a keyboard; nothing
 * but a keyboard takes 160px off the bottom of a phone.
 */
function useOnScreenKeyboard(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const check = () => setOpen(window.innerHeight - vv.height > 160);
    check();
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);

  return open;
}

export function BrandFooter() {
  const pathname = usePathname();
  const keyboardOpen = useOnScreenKeyboard();
  const matchesPanel = pathname?.startsWith("/volunteer/chat/") ?? false;

  // A credit line is the first thing that should go when a phone is down to
  // a few visible inches. It was sitting between the composer and the
  // keyboard, taking room from the one part of the screen someone is
  // actively using — and this is a bar nobody came here to read.
  if (keyboardOpen) return null;

  return (
    <footer
      className={cn(
        "flex shrink-0 items-center justify-center px-6 py-5",
        matchesPanel ? "bg-panel" : "bg-ink",
      )}
    >
      <a
        href="https://nexusglobalmission.com"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Nexus Global Mission — opens in a new tab"
        className="opacity-80 transition-opacity hover:opacity-100"
      >
        {/* The mark alone. It already carries the name; a line of text above
            it saying so again was a caption a logo does not need. A masked
            shape rather than an `<img>`, so its colour follows the same
            switch as the bar above instead of whatever tone the source file
            was drawn in — see above. */}
        <span
          aria-hidden="true"
          className={cn(
            "block aspect-[420/106] h-6",
            matchesPanel ? "bg-panel-ink" : "bg-canvas",
            "[-webkit-mask-image:url(/nexus-logo.webp)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-image:url(/nexus-logo.webp)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
          )}
        />
      </a>
    </footer>
  );
}
