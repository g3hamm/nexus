import { redirect } from "next/navigation";
import { VolunteerNav } from "@/components/VolunteerNav";
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
    // `relative` so the wide-screen half of `VolunteerNav` can pin itself to
    // the page's top-right corner from inside the header row below.
    <div className="relative w-full">
      <main className="mx-auto w-full max-w-6xl px-6 pb-12 pt-6 sm:pt-12">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* A CSS mask, not the raw asset — see BrandFooter for why: it
                reads only the file's shape and paints it in a token colour,
                so the sprig tracks the accent instead of whatever tone the
                source file happens to be drawn in. */}
            <span
              aria-hidden="true"
              className="bg-accent inline-block size-16 shrink-0 sm:size-20 [-webkit-mask-image:url(/olive-branch.png)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-image:url(/olive-branch.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
            />
            <div className="min-w-0">
              <h1 className="text-ink font-serif text-2xl sm:text-4xl">
                Welcome, {session.displayName}
              </h1>
              <p className="text-ink-subtle mt-1 text-sm sm:text-base">
                Let&rsquo;s make every conversation count.
              </p>
            </div>
          </div>

          {/* Sits in this row so the phone's menu button aligns with the
              greeting on its own; on a wide screen its other half breaks
              out to the page corner. */}
          <VolunteerNav />
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
