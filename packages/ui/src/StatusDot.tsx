import { cn } from "./cn.js";

export type Status = "available" | "busy" | "away" | "offline";

const TONES: Record<Status, string> = {
  available: "bg-positive",
  busy: "bg-caution",
  away: "bg-ink-subtle",
  offline: "bg-line-strong",
};

/**
 * Presence, shown as a dot with a text label beside it rather than colour
 * alone — a colour-only status is invisible to a meaningful share of readers.
 */
export function StatusDot({
  status,
  label,
  className,
}: {
  readonly status: Status;
  readonly label: string;
  readonly className?: string;
}) {
  return (
    <span
      className={cn("text-ink-muted inline-flex items-center gap-2 text-sm", className)}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", TONES[status])} />
      {label}
    </span>
  );
}
