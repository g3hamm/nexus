import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.js";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: "primary" | "quiet" | "ghost" | "danger";
  readonly size?: "sm" | "md" | "lg";
  readonly busy?: boolean;
  readonly children?: ReactNode;
}

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent-hover shadow-soft disabled:bg-line disabled:text-ink-subtle disabled:shadow-none",
  quiet:
    "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-raised",
  ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-surface-sunken",
  danger: "bg-danger text-white hover:opacity-90",
};

const SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3.5 text-sm rounded-md",
  md: "h-11 px-5 rounded-md",
  lg: "h-13 px-7 text-lg rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  busy = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // A busy button must not be clickable twice, but it also must not
      // disappear from the accessibility tree mid-action.
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 font-medium",
        // Never let flex squeeze a button narrower than its own label. Sitting
        // next to a `flex-1` textarea, the default shrink clipped "Send" to
        // "Sen" on a phone — the most important control in the product,
        // quietly broken by a layout default.
        "shrink-0 whitespace-nowrap",
        "ease-calm transition-colors duration-200",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { readonly className?: string }) {
  return (
    <span
      role="status"
      aria-label="Working"
      className={cn(
        "inline-block size-4 shrink-0 animate-spin rounded-full",
        "border-2 border-current border-t-transparent opacity-70",
        className,
      )}
    />
  );
}
