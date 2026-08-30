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
 * channel (its shape) and paints it in `bg-canvas`, so the mark is always
 * exactly as light or dark as the rest of the page's own background,
 * whatever colour that background actually is — no dependence on what tone
 * the source asset happens to be.
 *
 * Deliberately quiet, and the mark alone. This is a credit line, not a
 * masthead: nobody arrives at this product to find out who made it, and a
 * seeker least of all. It is a real link, and opens in a new tab on purpose
 * — a seeker or a volunteer mid-conversation who taps it should find the
 * ministry's site, not lose their place in a chat.
 */
export function BrandFooter() {
  return (
    <footer className="bg-ink flex shrink-0 items-center justify-center px-6 py-5">
      <a
        href="https://nexusglobalmission.com"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Nexus Global Mission — opens in a new tab"
        className="opacity-80 transition-opacity hover:opacity-100"
      >
        {/* The mark alone. It already carries the name; a line of text above
            it saying so again was a caption a logo does not need. A masked
            shape rather than an `<img>`, so its colour is `bg-canvas`
            instead of whatever tone the source file was drawn in — see above. */}
        <span
          aria-hidden="true"
          className="bg-canvas block aspect-[420/106] h-6 [-webkit-mask-image:url(/nexus-logo.webp)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-image:url(/nexus-logo.webp)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
        />
      </a>
    </footer>
  );
}
