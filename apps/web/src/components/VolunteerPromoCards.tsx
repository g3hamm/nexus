import Image from "next/image";
import Link from "next/link";
import { cn } from "@nexus/ui";
import { ArrowRightIcon } from "./CornerLink";

interface PromoCardProps {
  readonly href: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly cta: string;
  readonly image: string;
  readonly tint: "accent" | "practice";
}

function PromoCard({ href, eyebrow, title, description, cta, image, tint }: PromoCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "shadow-soft ease-calm flex items-center gap-4 rounded-lg p-5 transition-transform duration-200 hover:-translate-y-0.5",
        tint === "accent" ? "bg-accent-soft text-accent-soft-ink" : "bg-practice-soft text-practice-soft-ink",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">{eyebrow}</p>
        <h3 className="font-serif text-lg">{title}</h3>
        <p className="mt-1 text-sm opacity-80">{description}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
          {cta}
          <ArrowRightIcon />
        </span>
      </div>
      <Image src={image} alt="" width={96} height={96} className="size-20 shrink-0 sm:size-24" />
    </Link>
  );
}

/**
 * Two standing invitations beside the queue, not just below it — a
 * volunteer with an empty queue still has somewhere useful to go, and one
 * with a full queue is reminded these exist without them elbowing in on the
 * conversations that actually need attention.
 *
 * Practice gets its own colour rather than sharing the Academy card's sage
 * tint specifically so the two read as different kinds of action at a
 * glance — see `--color-practice` in `tokens.css`.
 */
export function VolunteerPromoCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <PromoCard
        href="/volunteer/academy"
        eyebrow="Learn"
        title="Apologetics Academy"
        description="Short lessons to help you answer hard questions with confidence."
        cta="Start a lesson"
        image="/academy-graphic.png"
        tint="accent"
      />
      <PromoCard
        href="/volunteer/practice"
        eyebrow="Rehearse"
        title="Practice with an AI Seeker"
        description="Try a conversation before the real thing, with no one waiting on you."
        cta="Start practicing"
        image="/practice-graphic.png"
        tint="practice"
      />
    </div>
  );
}
