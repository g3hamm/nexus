import type { Metadata, Viewport } from "next";
import { AppHeight } from "@/components/AppHeight";
import { BrandFooter } from "@/components/BrandFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus",
  description: "Talk with someone about Jesus, in your own language.",
  // A seeker may be somewhere this page is best not advertised.
  robots: { index: false, follow: false },
};

/*
 * Dark mode is switched off for now — light everywhere, whatever the device
 * asks for.
 *
 * Nothing has been deleted to do it. Every dark token is still sitting in
 * `tokens.css`, and this is the entire off switch: `colorScheme` and
 * `themeColor` here, plus `data-theme="light"` on `<html>` below.
 *
 * It is that small because the dark palette was already written to lose to
 * an explicit light choice — its media query is guarded with
 * `:root:not([data-theme="light"])`, so stamping that attribute stands the
 * whole thing down. (The `[data-theme="dark"]` block never matched anyway:
 * nothing in the app has ever set it.)
 *
 * To bring dark mode back: remove `colorScheme` below, restore the two-entry
 * `themeColor`, and drop `data-theme` from `<html>` — which also switches off
 * the matching `color-scheme` rule in `globals.css`. Nothing else.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never block zoom. Small text in a second language is hard enough already.
  maximumScale: 5,
  // Tokens alone would leave the browser's own furniture dark on a dark
  // device — form controls, scrollbars, and the canvas behind a page that
  // has not painted yet. This is what makes the page light rather than a
  // light page sitting in a dark frame.
  colorScheme: "light",
  themeColor: "#faf9f6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      {/*
        A column, so the credit line sits under the page rather than over it.
        Pages that want the whole viewport — a conversation, which is all
        composer and transcript — take `flex-1` and get what is left after the
        footer, instead of measuring themselves against the viewport and
        pushing it off the bottom.

        A definite height, not `min-h-dvh`. A minimum height is not a *definite* one —
        percentage heights and flex-basis further down the tree cannot resolve
        against it, so every `h-full` in a conversation view was quietly
        computing against its own content instead of the viewport. On a short
        conversation that is invisible; on a long one, the whole page grows to
        fit every message instead of the transcript scrolling inside a frame
        that stays put. A real height fixes it at the one place it needs
        fixing — but it also means `body` no longer has room to grow for a
        page that is legitimately taller than the screen, so the wrapper
        below carries its own `overflow-y-auto`: without it, that page's
        content doesn't get its own scrollbar, it visibly spills out of its
        allotted box while the footer — a flex sibling positioned against
        that box's *allocated* height, not its overflowing content — ends up
        stranded in the middle of the page it was meant to sit under.

        The height itself lives in `globals.css` rather than as a utility
        here, because it needs a fallback a utility cannot express: `100dvh`
        normally, overridden by a measured pixel value on iOS Safari, which
        can restore a page still laid out against the viewport it had when
        it left. That produced exactly the stranded footer described above,
        from the other direction — a `body` shorter than the screen rather
        than content taller than its box. See `AppHeight`.
      */}
      <body className="bg-canvas text-ink flex flex-col antialiased">
        <AppHeight />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        <BrandFooter />
      </body>
    </html>
  );
}
