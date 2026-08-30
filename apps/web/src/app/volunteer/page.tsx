import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VolunteerPromoCards } from "@/components/VolunteerPromoCards";
import { VolunteerQueue } from "@/components/VolunteerQueue";
import { VolunteerTip } from "@/components/VolunteerTip";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function VolunteerConsolePage() {
  const session = await staffSession();
  // An admin session is not a volunteer session; see requireVolunteer.
  if (session?.role !== "volunteer") redirect("/volunteer/login");

  return (
    <div className="relative w-full">
      {/* Pinned to the page's own top-right corner, the same place and the
          same offsets as the front door's "Sign In" — these are standing
          destinations rather than part of the reading order, and putting
          them at the edge keeps them out of the way of the greeting.

          `absolute`, not `fixed`. The front door never scrolls, so the two
          are indistinguishable there; this page does, and a fixed cluster
          would hover over the conversation rows for the whole scroll.

          Below `sm` it drops back into normal flow above the greeting —
          at phone width an absolutely positioned cluster lands on top of
          "Welcome". */}
      <nav className="flex items-center gap-3 px-6 pt-6 sm:absolute sm:end-5 sm:top-5 sm:z-10 sm:px-0 sm:pt-0">
        <NavIconLink href="/volunteer/academy" icon="/academy-icon.png" label="Academy" />
        <NavIconLink href="/volunteer/practice" icon="/practice-icon.png" label="Practice" />
        {/* Decorative for now — no link, no click handler. A real
            profile/preferences page is planned; the avatar becomes that
            entry point once it exists, not before. */}
        <Image
          src="/user-avatar.png"
          alt=""
          width={72}
          height={72}
          className="size-[4.5rem] shrink-0 rounded-full"
        />
      </nav>

      <main className="mx-auto w-full max-w-6xl px-6 pb-12 pt-6 sm:pt-12">
        <header>
          <div className="flex items-center gap-3">
            {/* A CSS mask, not the raw asset — see BrandFooter for why: it
                reads only the file's shape and paints it in a token colour,
                so the sprig tracks the accent instead of whatever tone the
                source file happens to be drawn in. */}
            <span
              aria-hidden="true"
              className="bg-accent inline-block size-20 shrink-0 [-webkit-mask-image:url(/olive-branch.png)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-image:url(/olive-branch.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
            />
            <div>
              <h1 className="text-ink font-serif text-3xl sm:text-4xl">
                Welcome, {session.displayName}
              </h1>
              <p className="text-ink-subtle mt-1">
                Let&rsquo;s make every conversation count.
              </p>
            </div>
          </div>
        </header>

        <div className="mt-10 flex flex-col gap-10">
          {/* The promo cards are handed to the queue rather than placed
              beside it, because they belong *between* its two sections —
              after the volunteer's own conversations, before the people
              waiting. A Server Component passed as `children` into a client
              component is rendered on the server and handed over as an
              already-rendered node, so these cards stay server-rendered. */}
          <VolunteerQueue>
            <VolunteerPromoCards />
          </VolunteerQueue>
          <VolunteerTip />
        </div>
      </main>
    </div>
  );
}

/**
 * A boxed icon tile with a visible caption — matches the pair of standing
 * destinations (Academy, Practice) to the pair of promo cards below them,
 * and the caption means a volunteer doesn't have to hover to find out what
 * either icon is for.
 *
 * `icon` differs per call, so unlike `BrandFooter`'s fixed Tailwind
 * arbitrary-value classes, the mask URL has to be set inline — everything
 * else about the technique (mask reads shape only, paint colour is a real
 * token) is the same.
 */
function NavIconLink({
  href,
  icon,
  label,
}: {
  readonly href: string;
  readonly icon: string;
  readonly label: string;
}) {
  return (
    <Link
      href={href}
      className="group border-line hover:border-line-strong bg-surface/70 ease-calm flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border px-5 py-3 transition-colors duration-200"
    >
      <span
        aria-hidden="true"
        className="bg-ink-muted group-hover:bg-ink ease-calm block size-9 transition-colors duration-200 [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
        style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
      />
      <span className="text-ink-muted group-hover:text-ink text-sm font-medium">
        {label}
      </span>
    </Link>
  );
}
