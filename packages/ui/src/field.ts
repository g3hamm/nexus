import { cn } from "./cn.js";

/**
 * One field chrome for the whole product.
 *
 * There were seven hand-written variants of this string, differing in radius,
 * padding, whether the placeholder was styled and whether a disabled field
 * dimmed. None of the differences were decisions — they were drift — and the
 * forms looked like they came from different applications.
 *
 * Two things are deliberately absent. There is no `outline-none`: the global
 * `:focus-visible` ring is the focus indicator, and suppressing the outline
 * meant each field had to reinvent one. And there is no `focus:border-accent`,
 * which is what produced the doubled ring — a recoloured border *and* an
 * outline, two indicators for one state.
 */
const SIZES = {
  sm: "rounded-md px-3 py-2 text-sm",
  md: "rounded-lg px-3.5 py-2.5",
  lg: "rounded-lg px-4 py-3 text-base",
} as const;

export type FieldSize = keyof typeof SIZES;

export function field(size: FieldSize = "md", extra?: string): string {
  return cn(
    "border-line bg-surface text-ink placeholder:text-ink-subtle",
    "w-full border transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-60",
    SIZES[size],
    extra,
  );
}
