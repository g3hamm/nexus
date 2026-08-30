import type { Metadata, Viewport } from "next";
import { BrandFooter } from "@/components/BrandFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus",
  description: "Talk with someone about Jesus, in your own language.",
  // A seeker may be somewhere this page is best not advertised.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never block zoom. Small text in a second language is hard enough already.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#1e2128" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/*
        A column, so the credit line sits under the page rather than over it.
        Pages that want the whole viewport — a conversation, which is all
        composer and transcript — take `flex-1` and get what is left after the
        footer, instead of measuring themselves against the viewport and
        pushing it off the bottom.

        `h-dvh`, not `min-h-dvh`. A minimum height is not a *definite* one —
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
      */}
      <body className="bg-canvas text-ink flex h-dvh flex-col antialiased">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        <BrandFooter />
      </body>
    </html>
  );
}
