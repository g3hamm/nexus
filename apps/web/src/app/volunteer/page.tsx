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
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {/* A CSS mask, not the raw asset — see BrandFooter for why: it
                reads only the file's shape and paints it in a token colour,
                so the sprig tracks the accent instead of whatever tone the
                source file happens to be drawn in. */}
            <span
              aria-hidden="true"
              className="bg-accent inline-block size-5 shrink-0 [-webkit-mask-image:url(/olive-branch.png)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-image:url(/olive-branch.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
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
          {/* Decorative only — nothing to link to until a real profile page
              exists. */}
          <Image
            src="/user-avatar.png"
            alt=""
            width={44}
            height={44}
            className="size-11 shrink-0 rounded-full"
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
 * A boxed icon button rather than the underlined text link this used to be
 * — matches the pair of standing destinations (Academy, Practice) to the
 * pair of promo cards below them instead of leaving the header feeling
 * unrelated to the rest of the page.
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
      aria-label={label}
      title={label}
      className="group border-line hover:border-line-strong ease-calm flex size-11 shrink-0 items-center justify-center rounded-md border transition-colors duration-200"
    >
      <span
        aria-hidden="true"
        className="bg-ink-muted group-hover:bg-ink ease-calm block size-5 transition-colors duration-200 [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
        style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
      />
    </Link>
  );
}
