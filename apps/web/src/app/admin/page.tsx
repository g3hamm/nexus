import { redirect } from "next/navigation";
import type { Coverage } from "@nexus/core";
import { AdminNav } from "@/components/AdminNav";
import { FlagQueue } from "@/components/FlagQueue";
import { container } from "@/server/container";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const claims = await staffSession();
  if (claims?.role !== "admin") redirect("/admin/login");

  const coverage = await container().volunteers.coverage();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <AdminNav current="flags" />
      <CoverageBanner coverage={coverage} />
      <FlagQueue />
    </main>
  );
}

/**
 * Who is on, at the top of the page an administrator already checks.
 *
 * An empty rota is not an error, so this is not an error banner — but it is
 * the single most actionable fact about the platform at any given moment, and
 * before this it was visible nowhere. A ministry that means to be reachable
 * cannot find out it was not from the seekers who gave up.
 *
 * Unlike the seeker's view, this shows the numbers. The person who has to fix
 * a gap in the rota needs to know how big it is.
 */
function CoverageBanner({ coverage }: { readonly coverage: Coverage }) {
  const { dot, text } = describe(coverage);

  return (
    <section className="border-line bg-surface-raised mb-6 flex items-center gap-2.5 rounded-[--radius-md] border px-4 py-3">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
      <p className="text-ink-muted text-sm">{text}</p>
    </section>
  );
}

function describe(coverage: Coverage): { dot: string; text: string } {
  const { state, freeNow, onlineNow } = coverage;

  if (state === "closed") {
    return {
      dot: "bg-caution",
      text: "No volunteers are on. Anyone who writes now is told plainly that nobody is here, and their message waits for whoever comes on next.",
    };
  }

  if (state === "busy") {
    return {
      dot: "bg-caution",
      text: `${plural(onlineNow, "volunteer")} on, all of them mid-conversation. New seekers are waiting.`,
    };
  }

  return {
    dot: "bg-positive",
    text: `${plural(freeNow, "volunteer")} free to take someone now, ${onlineNow} on in total.`,
  };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
