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
      */}
      <body className="bg-canvas text-ink flex min-h-dvh flex-col antialiased">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <BrandFooter />
      </body>
    </html>
  );
}
