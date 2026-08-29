import { redirect } from "next/navigation";
import Link from "next/link";
import { PRACTICE_SCENARIOS } from "@nexus/practice";
import { ScenarioPicker } from "@/components/ScenarioPicker";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const session = await staffSession();
  if (session?.role !== "volunteer") redirect("/volunteer/login");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header>
        <Link href="/volunteer" className="text-ink-subtle text-sm hover:underline">
          ← Back to the queue
        </Link>
        <h1 className="text-ink mt-4 font-serif text-2xl">Practice</h1>
        <p className="text-ink-muted mt-3 leading-relaxed">
          Real conversations with people who are hurting, angry, or testing you. These are
          simulated, and they are meant to be hard — none of them will be impressed by
          you, and several of them have better arguments than you do. When you are
          finished, you get an honest read on how it went.
        </p>
        <p className="text-ink-subtle mt-3 text-sm leading-relaxed">
          Almost all of them write in a language you probably do not read, which is the
          point: the delay, the unfamiliar script, and your idiom not surviving the trip
          are all part of this work, and none of them can be practised in English.
        </p>
        <p className="text-ink-subtle mt-3 text-sm leading-relaxed">
          This is the whole list, unattached. Most of these are also the exercise for a
          module in the{" "}
          <Link href="/volunteer/academy" className="underline underline-offset-2">
            Apologetics Academy
          </Link>
          , where you read first and the feedback afterwards is marked against what you
          had just read.
        </p>
      </header>

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
  );
}
