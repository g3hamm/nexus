/**
 * The shared shape of the two corner affordances on the front door — the
 * language switch and "Sign In" — so a pair of unrelated components in
 * opposite corners still reads as one deliberate decision rather than two
 * similar-looking one-offs that happened to drift apart.
 *
 * A bordered pill, not a filled button: the boundary is what makes each one
 * obviously tappable without depending on a hover state a touch screen never
 * fires, which matters on a page whose actual audience is mostly on phones.
 * No fill and no shadow, because a solid button here would outweigh
 * everything else on a page that has otherwise justified every pixel of
 * chrome it carries.
 */
export const CORNER_PILL_CLASS =
  "border-line hover:border-line-strong text-ink-subtle hover:text-ink-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors";

/**
 * The one icon style this app uses everywhere a small inline mark is
 * needed — exported so a third place (the sidebar's drag handle) can build
 * on it instead of hand-copying these seven properties again.
 */
export const ICON_PROPS = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "size-3.5 shrink-0",
};

/**
 * "This opens a menu below." Orientation-neutral under RTL — down is down
 * either way. Also reused by `LanguageMultiSelect`, which opens the same
 * kind of list from an ordinary form field rather than a corner pill —
 * `className` lets a caller outside this pair still fold in its own layout
 * (e.g. `ml-auto`) without a second copy of this path.
 */
export function ChevronDownIcon({ className }: { readonly className?: string } = {}) {
  return (
    <svg
      {...ICON_PROPS}
      className={
        className ? `${ICON_PROPS.className} ${className}` : ICON_PROPS.className
      }
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

/**
 * "This goes somewhere else." A different mark from the chevron above on
 * purpose — a link that navigates away is a different kind of action from
 * one that opens a menu in place, and the two ought not to look identical.
 *
 * Not localized: "Sign In" itself is deliberately left in English regardless
 * of the chosen front-door language (see `page.tsx`), so the arrow beside it
 * stays fixed the same way rather than trying to mirror for a language the
 * label next to it was never translated into.
 */
export function ArrowRightIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
