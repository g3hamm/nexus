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

/**
 * Every colour here is one of the fixed promo-card tokens, never the
 * theme-following ones — see the card family in `tokens.css` for why these
 * two cards stay light in both colour schemes.
 */
const TINTS = {
  accent: {
    card: "bg-accent-soft text-accent-soft-ink",
    deep: "text-accent-deep",
    button: "bg-accent-deep",
  },
  practice: {
    card: "bg-practice-soft text-practice-soft-ink",
    deep: "text-practice-deep",
    button: "bg-practice-deep",
  },
} as const;

function PromoCard({
  href,
  eyebrow,
  title,
  description,
  cta,
  image,
  tint,
}: PromoCardProps) {
  const tone = TINTS[tint];

  return (
    <Link
      href={href}
      className={cn(
        "group shadow-soft ease-calm flex gap-3 rounded-lg p-5 transition-transform duration-200 hover:-translate-y-0.5 sm:gap-4 sm:p-8",
        tone.card,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <p className={cn("text-xs font-semibold uppercase tracking-wider", tone.deep)}>
          {eyebrow}
        </p>
        {/* Two lines' worth of room whether or not this title needs it, so
            "Apologetics Academy" and "Practice with an AI Seeker" put their
            body copy at the same height side by side. */}
        <h3 className="mt-2 min-h-[2.4em] font-serif text-2xl leading-tight sm:text-3xl">
          {title}
        </h3>
        <p className="mb-6 mt-3 text-sm opacity-80">{description}</p>
        {/* `mt-auto` lines both cards' buttons up when the grid has stretched
            them to a shared height; the description's own bottom margin is
            what keeps the button off the text when it has not — on a phone
            these stack into one column and each card is sized by its own
            content, so there is no free space for `auto` to distribute and
            the button sat flush against the last line.

            The label neither wraps nor shrinks, so its width is the floor on
            how narrow the text column can go — which is what caps the
            illustration beside it. */}
        <span
          className={cn(
            "ease-calm mt-auto inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-3 text-sm font-medium text-white sm:gap-2 sm:px-5 transition-opacity duration-200 group-hover:opacity-90",
            tone.button,
          )}
        >
          {cta}
          <ArrowRightIcon />
        </span>
      </div>

      {/* Both source files were normalised so the drawing fills a fixed
          share of its canvas — academy's was carrying 40% empty space and
          rendering visibly smaller than practice at the same width. The
          size here is therefore real size, and the two stay in proportion
          with each other. */}
      <Image
        src={image}
        alt=""
        width={320}
        height={320}
        className="w-[44%] shrink-0 self-center sm:w-[58%]"
      />
    </Link>
  );
}

/**
 * Two standing invitations, sitting between the volunteer's own
 * conversations and the queue of people waiting.
 *
 * Deliberately below the conversations rather than above them: someone
 * already mid-conversation should see that first. But above "waiting to
 * talk", because a volunteer with an empty queue is exactly the one who
 * should be nudged toward learning something instead of watching a bench.
 */
export function VolunteerPromoCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <PromoCard
        href="/volunteer/academy"
        eyebrow="Learn"
        title="Apologetics Academy"
        description="Build the knowledge and confidence to answer questions with clarity and grace."
        cta="Enter Academy"
        image="/academy-graphic.png"
        tint="accent"
      />
      <PromoCard
        href="/volunteer/practice"
        eyebrow="Practice"
        title="Practice with an AI Seeker"
        description="Sharpen your skills in realistic conversations before talking with a real seeker."
        cta="Start Practicing"
        image="/practice-graphic.png"
        tint="practice"
      />
    </div>
  );
}
