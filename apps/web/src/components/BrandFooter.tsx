/**
 * Attribution, at the foot of every page.
 *
 * Plain `<img>` rather than `next/image`: the file is already sized and
 * encoded for the box it sits in, so the optimiser has nothing left to do and
 * would only add a billed transform and a layout dance to a 20 KB asset.
 *
 * The supplied mark is pale grey on transparent, drawn for a dark background.
 * It was inverted once, at rest, rather than with a CSS filter — filtering a
 * textured mark at low opacity turns it to mud. `dark:invert` puts it back for
 * a viewer in dark mode, where the original was right all along.
 *
 * Deliberately quiet, and the mark alone. This is a credit line, not a
 * masthead: nobody arrives at this product to find out who made it, and a
 * seeker least of all.
 */
export function BrandFooter() {
  return (
    <footer className="flex shrink-0 items-center justify-center px-6 py-5">
      {/* The mark alone. It already carries the name; a line of text above it
          saying so again was a caption a logo does not need. */}
      <img
        src="/nexus-logo.webp"
        alt="Nexus Global Mission"
        className="h-4 w-auto opacity-50 dark:invert"
      />
    </footer>
  );
}
