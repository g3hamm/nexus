import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findAcademyModule, parseModuleBody } from "@nexus/academy";
import { findScenario } from "@nexus/practice";
import { ExerciseLauncher } from "@/components/ExerciseLauncher";
import { ModuleProse } from "@/components/ModuleProse";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AcademyModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;

  const session = await staffSession();
  // Volunteers only, matching Practice and the Academy index.
  if (session?.role !== "volunteer") redirect("/volunteer/login");

  const found = findAcademyModule(moduleId);
  if (!found) notFound();
  const { track, module } = found;

  const exercises = (module.exercises ?? [])
    .map((id) => findScenario(id))
    .filter((s) => s !== null)
    .map((s) => ({
      id: s.id,
      title: s.title,
      premise: s.premise,
      difficulty: s.difficulty,
      language: s.language,
      reachesCrisis: s.reachesCrisis,
    }));

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
        <h1 className="text-ink mt-2 font-serif text-2xl">{module.title}</h1>
        <p className="text-ink-muted mt-3 leading-relaxed">{module.summary}</p>
      </header>

      {/* Named before the reading rather than after it. Somebody who knows
          what they are meant to come away able to do reads differently, and
          this is the same list the debrief is given afterwards. */}
      {module.teaches && module.teaches.length > 0 ? (
        <section className="border-line bg-surface-sunken mt-8 rounded-[--radius-md] border p-5">
          <h2 className="text-ink text-sm font-semibold">What this is for</h2>
          <ul className="text-ink-muted mt-2 space-y-1.5 text-sm leading-relaxed">
            {module.teaches.map((point) => (
              <li key={point} className="flex gap-3">
                <span className="text-ink-subtle select-none">—</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {module.body ? (
        <>
          <div className="mt-8">
            <ModuleProse blocks={parseModuleBody(module.body)} />
          </div>

          {/* Same reasoning as the knowledge sidebar: a volunteer about to
              repeat an argument to a stranger should know whose it is. */}
          {module.source ? (
            <p className="text-ink-subtle border-line mt-10 border-t pt-5 text-sm leading-relaxed">
              {module.source}
            </p>
          ) : null}
        </>
      ) : (
        <div className="border-line mt-8 rounded-[--radius-md] border border-dashed p-5">
          <p className="text-ink-muted text-sm leading-relaxed">
            {module.status === "drafting"
              ? "The reading for this module is being written. It is in the outline so you know it is coming, not because there is anything here yet."
              : "The reading for this module is planned and not written yet. Your ministry’s apologetics lead owns the curriculum; this page will fill in when they write it."}
            {exercises.length > 0
              ? " The exercise below works now, and is worth doing on its own."
              : ""}
          </p>
        </div>
      )}

      {exercises.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-ink font-serif text-xl">Now practise it</h2>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">
            {exercises.length === 1
              ? "One conversation, with somebody who has not read any of this."
              : "Conversations with people who have not read any of this."}{" "}
            They are simulated, they are meant to be hard, and none of them will be
            impressed by you. When you finish, the feedback knows which module you came
            from and marks you against it.
          </p>
          <div className="mt-5">
            <ExerciseLauncher moduleId={module.id} exercises={exercises} />
          </div>
        </section>
      ) : (
        <p className="text-ink-subtle mt-12 text-sm leading-relaxed">
          This module has no exercise yet.{" "}
          <Link href="/volunteer/practice" className="underline underline-offset-2">
            Practice
          </Link>{" "}
          has the full list of scenarios in the meantime.
        </p>
      )}
    </main>
  );
}
