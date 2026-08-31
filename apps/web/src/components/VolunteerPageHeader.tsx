import Link from "next/link";
import { cn } from "@nexus/ui";
import { VolunteerNav } from "./VolunteerNav";

/**
 * The masthead the Academy and Practice pages share with the dashboard.
 *
 * Each page is marked with its own icon in its own colour — the same pair
 * the promo cards use to tell the two apart at a glance — so arriving from
 * a card lands somewhere that visibly belongs to it.
 *
 * `VolunteerNav` comes along rather than living only on the dashboard: it
 * carries Sign out, and a volunteer part-way through a lesson should not
 * have to navigate home to leave.
 */
export function VolunteerPageHeader({
  icon,
  tint,
  title,
  intro,
}: {
  readonly icon: string;
  readonly tint: "accent" | "practice";
  readonly title: string;
  readonly intro: React.ReactNode;
}) {
  return (
    <header>
      <Link
        href="/volunteer"
        className="text-ink-subtle hover:text-ink-muted ease-calm inline-flex items-center gap-1.5 text-sm transition-colors duration-200"
      >
        <span aria-hidden="true">&larr;</span>
        Back to your conversations
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Masked, so the mark takes the page's colour rather than the
              near-black it was drawn in — same technique as BrandFooter. */}
          <span
            aria-hidden="true"
            className={cn(
              "inline-block size-14 shrink-0 [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] sm:size-16",
              tint === "accent" ? "bg-accent-deep" : "bg-practice-deep",
            )}
            style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
          />
          <h1 className="text-ink font-serif text-2xl sm:text-4xl">{title}</h1>
        </div>

        <VolunteerNav />
      </div>

      <div className="text-ink-muted mt-4 space-y-3 leading-relaxed">{intro}</div>
    </header>
  );
}
