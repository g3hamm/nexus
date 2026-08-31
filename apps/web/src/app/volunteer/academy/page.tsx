import Link from "next/link";
import { redirect } from "next/navigation";
import { ACADEMY_TRACKS, academyProgress } from "@nexus/academy";
import type { AcademyModuleStatus } from "@nexus/core";
import { Card, cn } from "@nexus/ui";
import { ChevronRightIcon } from "@/components/CornerLink";
import { VolunteerPageHeader } from "@/components/VolunteerPageHeader";
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
    <div className="relative w-full">
      <main className="mx-auto w-full max-w-5xl px-6 pb-16 pt-6 sm:pt-12">
        <VolunteerPageHeader
          icon="/academy-icon.png"
          tint="accent"
          title="Apologetics Academy"
          intro={
            <>
              <p>
                Modules, not articles. Each one has something to read and a conversation
                to have — with somebody simulated who has not read any of it, and who
                will not be impressed by you having just done so. When you finish, the
                feedback knows which module you came from.
              </p>
              <p className="text-ink-subtle text-sm">
                This is for volunteers. Nothing here is shown to seekers, and nothing you
                read here is visible in a conversation.
              </p>
            </>
          }
        />

        {/* Said plainly, because a training library that hides its own gaps
            teaches volunteers to trust it further than it has earned. The
            second number is the more useful one: a module nobody has written
            yet can still hand somebody a hard conversation to have. */}
        <section className="bg-accent-soft text-accent-soft-ink mt-8 rounded-lg p-6">
          <h2 className="text-accent-deep text-xs font-semibold uppercase tracking-wider">
            Where the curriculum stands
          </h2>
          <p className="mt-2 font-serif text-xl">
            {progress.published} of {progress.total} modules written ·{" "}
            {progress.withExercise} with an exercise you can do now
          </p>
          <p className="mt-2 text-sm opacity-80">
            The outline below is the plan. The curriculum belongs to your ministry&rsquo;s
            apologetics lead, not to this software, and most of the reading is waiting to
            be written by them. The exercises are real and work today — a module whose
            reading is unwritten is still worth doing for the conversation.
          </p>
        </section>

        <div className="mt-12 space-y-10">
          {ACADEMY_TRACKS.map((track) => (
            <section key={track.id}>
              <h2 className="text-ink font-serif text-2xl">{track.title}</h2>
              <p className="text-ink-muted mt-2 leading-relaxed">{track.summary}</p>

              {/* One list per track rather than a card per module. Most of
                  this curriculum is unwritten, and twenty-four boxes of
                  mostly nothing buries what a volunteer can do today. */}
              <Card padded={false} className="divide-line mt-5 divide-y overflow-hidden">
                {track.modules.map((module) => {
                  const written = module.status === "published";
                  const exercises = module.exercises?.length ?? 0;

                  return (
                    <Link
                      key={module.id}
                      href={`/volunteer/academy/${module.id}`}
                      className="hover:bg-surface-sunken ease-calm flex items-center gap-4 px-5 py-4 transition-colors duration-200"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h3
                            className={cn(
                              "font-serif text-lg",
                              written ? "text-ink" : "text-ink-muted",
                            )}
                          >
                            {module.title}
                          </h3>
                          {written ? null : (
                            <span className="bg-surface-sunken text-ink-subtle shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium">
                              {STATUS_LABEL[module.status]}
                            </span>
                          )}
                        </div>
                        <p className="text-ink-subtle mt-1 text-sm leading-relaxed">
                          {module.summary}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {written ? (
                            <span className="text-ink-muted">
                              Read · {module.minutes} min
                            </span>
                          ) : null}
                          {exercises > 0 ? (
                            <span className="text-accent-deep font-medium">
                              {exercises === 1
                                ? "Exercise ready"
                                : `${exercises} exercises ready`}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ChevronRightIcon className="text-ink-subtle size-5" />
                    </Link>
                  );
                })}
              </Card>
            </section>
          ))}
        </div>

        <p className="text-ink-subtle mt-12 text-sm leading-relaxed">
          Every exercise here also lives in{" "}
          <Link
            href="/volunteer/practice"
            className="text-practice-deep font-medium underline underline-offset-2"
          >
            Practice
          </Link>
          , where you can pick a conversation without a module attached.
        </p>
      </main>
    </div>
  );
}
