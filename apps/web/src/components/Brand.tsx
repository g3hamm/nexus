/**
 * The brand marks, and where they are allowed to appear.
 *
 * Plain `<img>` rather than `next/image` on purpose. These are already sized
 * and encoded for exactly the boxes they sit in, so the optimiser has nothing
 * left to do — it would only add a billed transform and a layout dance to
 * files that are 15–100 KB as they stand.
 */

/** The wordmark alone. For a header, where the app has already been introduced. */
export function Wordmark({ className = "h-6" }: { readonly className?: string }) {
  return <img src="/olivechat-wordmark.webp" alt="olivechat" className={`w-auto ${className}`} />;
}

/** Wordmark and branch together. For a front door, where it has not. */
export function BrandMark({ className = "w-56" }: { readonly className?: string }) {
  return (
    <img
      src="/olivechat-mark.webp"
      alt="olivechat"
      className={`h-auto ${className}`}
      // The one image on the critical path of a seeker's first visit.
      fetchPriority="high"
    />
  );
}

/**
 * Attribution, at the foot of a page.
 *
 * The supplied Nexus mark is pale grey on transparent — drawn for a dark
 * background, invisible on this one. It is inverted at build time rather than
 * with a CSS filter, because filtering a textured mark at low opacity turns it
 * to mud.
 */
export function BrandFooter({ className = "" }: { readonly className?: string }) {
  return (
    <footer className={`flex flex-col items-center gap-2 pt-10 pb-6 ${className}`}>
      <span className="text-ink-subtle text-xs">A ministry of</span>
      <img
        src="/nexus-logo.webp"
        alt="Nexus Global Mission"
        className="h-5 w-auto opacity-50"
      />
    </footer>
  );
}

/**
 * Olive branches in two opposite corners.
 *
 * Desktop only, and that is the whole reason this is safe. On a phone the
 * conversation fills the viewport edge to edge, so a corner illustration would
 * sit underneath the message bubbles — behind the worst thing someone has ever
 * typed. On a wide screen the content is a centred column with empty gutters,
 * and the branches live out there, framing rather than intruding.
 *
 * Fixed rather than absolute so they stay put while a transcript scrolls past,
 * behind everything, and unreachable by a pointer or a screen reader.
 */
export function OliveFrame() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 hidden select-none lg:block"
    >
      <img
        src="/olive-upperleft.webp"
        alt=""
        className="absolute top-0 left-0 w-52 opacity-20 xl:w-64"
      />
      <img
        src="/olive-bottomright.webp"
        alt=""
        className="absolute right-0 bottom-0 w-52 opacity-20 xl:w-64"
      />
    </div>
  );
}
