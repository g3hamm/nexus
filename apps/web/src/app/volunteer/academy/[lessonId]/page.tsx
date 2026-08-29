import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findAcademyLesson, parseLesson } from "@nexus/academy";
import { findScenario } from "@nexus/practice";
import { LessonProse } from "@/components/LessonProse";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AcademyLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;

  const session = await staffSession();
  // Volunteers only, matching Practice and the Academy index.
  if (session?.role !== "volunteer") redirect("/volunteer/login");

  const found = findAcademyLesson(lessonId);
  if (!found) notFound();
  const { track, lesson } = found;

  const scenarios = (lesson.practiceScenarioIds ?? [])
    .map((id) => findScenario(id))
    .filter((s) => s !== null);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <header>
        <Link
          href="/volunteer/academy"
          className="text-ink-subtle text-sm hover:underline"
        >
          ← Apologetics Academy
        </Link>
        <p className="text-ink-subtle mt-4 text-xs uppercase tracking-wide">
          {track.title}
        </p>
        <h1 className="text-ink mt-2 font-serif text-2xl">{lesson.title}</h1>
        <p className="text-ink-muted mt-3 leading-relaxed">{lesson.summary}</p>
      </header>

      {lesson.body ? (
        <>
          <div className="mt-8">
            <LessonProse blocks={parseLesson(lesson.body)} />
          </div>

          {/* Same reasoning as the knowledge sidebar: a volunteer about to
              repeat an argument to a stranger should know whose it is. */}
          {lesson.source ? (
            <p className="text-ink-subtle border-line mt-10 border-t pt-5 text-sm leading-relaxed">
              {lesson.source}
            </p>
          ) : null}
        </>
      ) : (
        <div className="border-line mt-10 rounded-[--radius-md] border border-dashed p-5">
          <p className="text-ink-muted text-sm leading-relaxed">
            {lesson.status === "drafting"
              ? "This one is being written. It is in the outline so you know it is coming, not because there is anything here yet."
              : "This lesson is planned and not written yet. Your ministry’s apologetics lead owns the curriculum; this page will fill in when they write it."}
          </p>
        </div>
      )}

      {scenarios.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-ink font-serif text-lg">Put it to work</h2>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">
            {scenarios.length === 1
              ? "One practice scenario exercises this lesson:"
              : "These practice scenarios exercise this lesson:"}
          </p>
          <ul className="text-ink-muted mt-3 space-y-1 text-sm">
            {scenarios.map((scenario) => (
              <li key={scenario.id}>— {scenario.title}</li>
            ))}
          </ul>
          <Link
            href="/volunteer/practice"
            className="text-ink-muted mt-4 inline-block text-sm underline underline-offset-2"
          >
            Go to Practice
          </Link>
        </section>
      ) : null}
    </main>
  );
}
