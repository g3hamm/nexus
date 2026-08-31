import Link from "next/link";
import { redirect } from "next/navigation";
import { PRACTICE_SCENARIOS } from "@nexus/practice";
import { ScenarioPicker } from "@/components/ScenarioPicker";
import { VolunteerPageHeader } from "@/components/VolunteerPageHeader";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const session = await staffSession();
  if (session?.role !== "volunteer") redirect("/volunteer/login");

  return (
    <div className="relative w-full">
      <main className="mx-auto w-full max-w-5xl px-6 pb-16 pt-6 sm:pt-12">
        <VolunteerPageHeader
          icon="/practice-icon.png"
          tint="practice"
          title="Practice with an AI Seeker"
          intro={
            <>
              <p>
                Conversations with people who are hurting, angry, or testing you. These
                are simulated, and they are meant to be hard — none of them will be
                impressed by you, and several of them have better arguments than you do.
                When you are finished, you get an honest read on how it went.
              </p>
              <p className="text-ink-subtle text-sm">
                Almost all of them write in a language you probably do not read, which is
                the point: the delay, the unfamiliar script, and your idiom not surviving
                the trip are all part of this work, and none of them can be practised in
                English.
              </p>
            </>
          }
        />

        {/* Worth saying on this page specifically: a practice session opens
            in the same conversation view as a real one, and lands in the
            same list on the dashboard afterwards. It is marked there, but
            somebody should know that before they start one. */}
        <section className="bg-practice-soft text-practice-soft-ink mt-8 rounded-lg p-6">
          <h2 className="text-practice-deep text-xs font-semibold uppercase tracking-wider">
            Before you start
          </h2>
          <p className="mt-2 text-sm opacity-80">
            A rehearsal opens in the same window as a real conversation and stays in your
            list on the home screen afterwards, marked as practice. Nobody is waiting on
            you in one — you can leave it and come back, or abandon it entirely, and no
            seeker is affected either way.
          </p>
          <p className="mt-2 text-sm opacity-80">
            Most of these are also the exercise for a module in the{" "}
            <Link
              href="/volunteer/academy"
              className="text-accent-deep font-medium underline underline-offset-2"
            >
              Apologetics Academy
            </Link>
            , where you read first and the feedback afterwards is marked against what you
            had just read.
          </p>
        </section>

        <div className="mt-10">
          <ScenarioPicker
            scenarios={PRACTICE_SCENARIOS.map((s) => ({
              id: s.id,
              title: s.title,
              premise: s.premise,
              difficulty: s.difficulty,
              language: s.language,
              competencies: s.competencies,
              reachesCrisis: s.reachesCrisis,
            }))}
          />
        </div>
      </main>
    </div>
  );
}
