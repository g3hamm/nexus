import Link from "next/link";
import { redirect } from "next/navigation";
import { ACADEMY_TRACKS, academyProgress } from "@nexus/academy";
import type { AcademyLessonStatus } from "@nexus/core";
import { cn } from "@nexus/ui";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<AcademyLessonStatus, string> = {
  published: "",
  drafting: "Being written",
  planned: "Planned",
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
          The reading behind the work. Practice puts you in front of someone difficult;
          this is where you go beforehand, and afterwards when a conversation did not go
          the way you wanted.
        </p>
        <p className="text-ink-subtle mt-3 text-sm leading-relaxed">
          This is for volunteers. Nothing here is shown to seekers, and nothing you read
          here is visible in a conversation.
        </p>
      </header>

      {/* Said plainly, because a training library that hides its own gaps
          teaches volunteers to trust it further than it has earned. */}
      <section className="border-line bg-surface-sunken mt-8 rounded-[--radius-md] border p-5">
        <h2 className="text-ink text-sm font-semibold">
          {progress.published} of {progress.total} lessons are written
        </h2>
        <p className="text-ink-muted mt-2 text-sm leading-relaxed">
          The outline below is the plan. The curriculum belongs to your ministry&rsquo;s
          apologetics lead, not to this software, and most of it is waiting to be written
          by them. Every lesson says where it stands, and the two that are finished are
          about method rather than doctrine.
        </p>
      </section>

      <div className="mt-12 space-y-10">
        {ACADEMY_TRACKS.map((track) => (
          <section key={track.id}>
            <h2 className="text-ink font-serif text-xl">{track.title}</h2>
            <p className="text-ink-muted mt-2 text-sm leading-relaxed">{track.summary}</p>

            {/* One card per track rather than one per lesson. Most of this
                curriculum is unwritten, and twenty-four boxes of mostly
                nothing buries the two lessons a volunteer can actually read. */}
            <ul className="border-line bg-surface divide-line mt-5 divide-y rounded-[--radius-md] border">
              {track.lessons.map((lesson) => {
                const written = lesson.status === "published";

                const row = (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0 flex-1">
                      <h3
                        className={cn(
                          "font-serif text-lg",
                          written ? "text-ink" : "text-ink-muted",
                        )}
                      >
                        {lesson.title}
                      </h3>
                      <p className="text-ink-subtle mt-1 text-sm leading-relaxed">
                        {lesson.summary}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 whitespace-nowrap text-xs",
                        written ? "text-accent" : "text-ink-subtle",
                      )}
                    >
                      {written
                        ? `Read · ${lesson.minutes} min`
                        : STATUS_LABEL[lesson.status]}
                    </span>
                  </div>
                );

                return (
                  <li key={lesson.id}>
                    {written ? (
                      <Link
                        href={`/volunteer/academy/${lesson.id}`}
                        className="hover:bg-surface-raised block px-5 py-4 transition-colors"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="px-5 py-4">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-ink-subtle mt-12 text-sm leading-relaxed">
        Reading is half of it.{" "}
        <Link href="/volunteer/practice" className="underline underline-offset-2">
          Practice
        </Link>{" "}
        is the other half, and several lessons name the scenarios that put them to work.
      </p>
    </main>
  );
}
