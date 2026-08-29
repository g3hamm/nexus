import Link from "next/link";
import { redirect } from "next/navigation";
import { ACADEMY_TRACKS, academyProgress } from "@nexus/academy";
import type { AcademyModuleStatus } from "@nexus/core";
import { cn } from "@nexus/ui";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<AcademyModuleStatus, string> = {
  published: "",
  drafting: "Being written",
  planned: "Not written yet",
};

export default async function AcademyPage() {
  const session = await staffSession();
  // Volunteers only, matching Practice. An admin session is not a volunteer
  // session; see requireVolunteer.
  if (session?.role !== "volunteer") redirect("/volunteer/login");

  const progress = academyProgress();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header>
        <Link href="/volunteer" className="text-ink-subtle text-sm hover:underline">
          ← Back to the queue
        </Link>
        <h1 className="text-ink mt-4 font-serif text-2xl">Apologetics Academy</h1>
        <p className="text-ink-muted mt-3 leading-relaxed">
          Modules, not articles. Each one has something to read and a conversation to have
          — with somebody simulated who has not read any of it, and who will not be
          impressed by you having just done so. When you finish, the feedback knows which
          module you came from.
        </p>
        <p className="text-ink-subtle mt-3 text-sm leading-relaxed">
          This is for volunteers. Nothing here is shown to seekers, and nothing you read
          here is visible in a conversation.
        </p>
      </header>

      {/* Said plainly, because a training library that hides its own gaps
          teaches volunteers to trust it further than it has earned. The
          second number is the more useful one: a module nobody has written
          yet can still hand somebody a hard conversation to have. */}
      <section className="border-line bg-surface-sunken mt-8 rounded-[--radius-md] border p-5">
        <h2 className="text-ink text-sm font-semibold">
          {progress.published} of {progress.total} modules are written ·{" "}
          {progress.withExercise} have an exercise you can do now
        </h2>
        <p className="text-ink-muted mt-2 text-sm leading-relaxed">
          The outline below is the plan. The curriculum belongs to your ministry&rsquo;s
          apologetics lead, not to this software, and most of the reading is waiting to be
          written by them. The exercises are real and work today — a module whose reading
          is unwritten is still worth doing for the conversation.
        </p>
      </section>

      <div className="mt-12 space-y-10">
        {ACADEMY_TRACKS.map((track) => (
          <section key={track.id}>
            <h2 className="text-ink font-serif text-xl">{track.title}</h2>
            <p className="text-ink-muted mt-2 text-sm leading-relaxed">{track.summary}</p>

            {/* One card per track rather than one per module. Most of this
                curriculum is unwritten, and twenty-four boxes of mostly
                nothing buries what a volunteer can actually do today. */}
            <ul className="border-line bg-surface divide-line mt-5 divide-y rounded-[--radius-md] border">
              {track.modules.map((module) => {
                const written = module.status === "published";
                const exercises = module.exercises?.length ?? 0;

                return (
                  <li key={module.id}>
                    <Link
                      href={`/volunteer/academy/${module.id}`}
                      className="hover:bg-surface-raised block px-5 py-4 transition-colors"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <div className="min-w-0 flex-1">
                          <h3
                            className={cn(
                              "font-serif text-lg",
                              written ? "text-ink" : "text-ink-muted",
                            )}
                          >
                            {module.title}
                          </h3>
                          <p className="text-ink-subtle mt-1 text-sm leading-relaxed">
                            {module.summary}
                          </p>
                          {exercises > 0 ? (
                            <p className="text-accent mt-1.5 text-xs">
                              {exercises === 1
                                ? "Exercise ready"
                                : `${exercises} exercises ready`}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 whitespace-nowrap text-xs",
                            written ? "text-ink-muted" : "text-ink-subtle",
                          )}
                        >
                          {written
                            ? `Read · ${module.minutes} min`
                            : STATUS_LABEL[module.status]}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-ink-subtle mt-12 text-sm leading-relaxed">
        Every exercise here also lives in{" "}
        <Link href="/volunteer/practice" className="underline underline-offset-2">
          Practice
        </Link>
        , where you can pick a conversation without a module attached.
      </p>
    </main>
  );
}
