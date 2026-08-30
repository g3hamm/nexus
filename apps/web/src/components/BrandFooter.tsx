/**
 * Attribution, at the foot of every page — a dark strip, not a floating mark.
 *
 * Plain `<img>` rather than `next/image`: the file is already sized and
 * encoded for the box it sits in, so the optimiser has nothing left to do and
 * would only add a billed transform and a layout dance to a 20 KB asset.
 *
 * The supplied mark is pale grey on transparent, drawn for a dark background
 * — which used to mean fighting the page's own light-or-dark canvas colour
 * with a conditional `dark:invert`. A dedicated dark bar removes the fight
 * entirely: the mark now sits on a background that is always dark, in both
 * colour schemes, so it is always shown in its native form. One fewer thing
 * that could disagree with itself.
 *
 * `bg-panel`, the same dark slab already used for the volunteer's sidebar,
 * rather than a new raw black — the point is a second material this product
 * already has a name for, not a one-off colour invented for a footer.
 *
 * Deliberately quiet, and the mark alone. This is a credit line, not a
 * masthead: nobody arrives at this product to find out who made it, and a
 * seeker least of all. It is a real link, and opens in a new tab on purpose
 * — a seeker or a volunteer mid-conversation who taps it should find the
 * ministry's site, not lose their place in a chat.
 */
export function BrandFooter() {
  return (
    <footer className="bg-panel flex shrink-0 items-center justify-center px-6 py-5">
      <a
        href="https://nexusglobalmission.com"
        target="_blank"
        rel="noopener noreferrer"
        className="opacity-80 transition-opacity hover:opacity-100"
      >
        {/* The mark alone. It already carries the name; a line of text above
            it saying so again was a caption a logo does not need. */}
        <img
          src="/nexus-logo.webp"
          alt="Nexus Global Mission — opens in a new tab"
          className="h-6 w-auto"
        />
      </a>
    </footer>
  );
}
