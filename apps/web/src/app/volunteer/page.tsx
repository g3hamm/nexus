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
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            {/* A CSS mask, not the raw asset — see BrandFooter for why: it
                reads only the file's shape and paints it in a token colour,
                so the sprig tracks the accent instead of whatever tone the
                source file happens to be drawn in. */}
            <span
              aria-hidden="true"
              className="bg-accent inline-block size-7 shrink-0 [-webkit-mask-image:url(/olive-branch.png)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-image:url(/olive-branch.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
            />
            <h1 className="text-ink font-serif text-2xl">Welcome, {session.displayName}</h1>
          </div>
          <p className="text-ink-subtle mt-1 text-sm">
            Let&rsquo;s make every conversation count.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-2">
            <NavIconLink href="/volunteer/academy" icon="/academy-icon.png" label="Academy" />
            <NavIconLink href="/volunteer/practice" icon="/practice-icon.png" label="Practice" />
          </nav>
          {/* Decorative only for now — no link, no click handler. A real
              profile/preferences page is planned; the avatar becomes that
              entry point once it exists, not before. */}
          <Image
            src="/user-avatar.png"
            alt=""
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-full"
          />
        </div>
      </header>

      <div className="mt-8 flex flex-col gap-8">
        <VolunteerPromoCards />
        <VolunteerQueue />
        <VolunteerTip />
      </div>
    </main>
  );
}

/**
 * A boxed icon tile with a visible caption — matches the pair of standing
 * destinations (Academy, Practice) to the pair of promo cards below them,
 * and the caption means a volunteer doesn't have to hover to find out what
 * either icon is for (the icon alone was ambiguous — a graduation cap and a
 * boxing-glove-adjacent line drawing are not self-explanatory at a glance).
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
      className="group border-line hover:border-line-strong ease-calm flex shrink-0 flex-col items-center justify-center gap-1 rounded-md border px-3.5 py-2.5 transition-colors duration-200"
    >
      <span
        aria-hidden="true"
        className="bg-ink-muted group-hover:bg-ink ease-calm block size-6 transition-colors duration-200 [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
        style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
      />
      <span className="text-ink-muted group-hover:text-ink text-xs font-medium">{label}</span>
    </Link>
  );
}
