"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { endonym, type PracticeDifficulty } from "@nexus/core";
import { Spinner } from "@nexus/ui";

export interface ExerciseSummary {
  readonly id: string;
  readonly title: string;
  readonly premise: string;
  readonly difficulty: PracticeDifficulty;
  readonly language: string;
  readonly reachesCrisis: boolean;
}

const DIFFICULTY_LABEL: Record<PracticeDifficulty, string> = {
  searching: "Searching",
  sceptical: "Arguing",
  hostile: "Hostile",
};

/**
 * A module's exercise, started from the module itself.
 *
 * The module id travels to the conversation in the URL, and from there to the
 * debrief, so the feedback afterwards knows what the volunteer had just read.
 * That is the whole difference between a module and a page: somebody who has
 * read about a mistake and then makes it is in the best possible position to
 * be told so.
 *
 * The premise is shown and the persona never is, same as the practice list.
 * A volunteer who has read the character notes practises confirming a
 * backstory they already know.
 */
export function ExerciseLauncher({
  moduleId,
  exercises,
}: {
  readonly moduleId: string;
  readonly exercises: readonly ExerciseSummary[];
}) {
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(scenarioId: string) {
    setStarting(scenarioId);
    setError(null);
    try {
      const response = await fetch("/api/practice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Could not start that exercise.");
      }

      const { conversationId } = (await response.json()) as { conversationId: string };
      router.push(
        `/volunteer/chat/${conversationId}?module=${encodeURIComponent(moduleId)}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start that exercise.");
      setStarting(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-danger text-sm">{error}</p> : null}

      {exercises.map((exercise) => (
        <article
          key={exercise.id}
          className="border-line bg-surface rounded-[--radius-md] border p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-ink font-serif text-lg">{exercise.title}</h3>
            <span className="text-ink-subtle text-xs">
              {DIFFICULTY_LABEL[exercise.difficulty]} · {endonym(exercise.language)}
            </span>
          </div>

          <p className="text-ink-muted mt-2 text-sm leading-relaxed">
            {exercise.premise}
          </p>

          {exercise.reachesCrisis ? (
            <p className="text-ink-subtle border-line-strong mt-3 border-l-2 pl-3 text-sm leading-relaxed">
              This one reaches a disclosure of self-harm. It is here so that the first
              time you meet it is not the first time it is real. You can stop at any
              point, and nobody is alerted.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void start(exercise.id)}
            disabled={starting !== null}
            className="bg-accent text-accent-ink hover:bg-accent-hover mt-4 inline-flex items-center gap-2 rounded-[--radius-sm] px-4 py-2 text-sm disabled:opacity-60"
          >
            {starting === exercise.id ? <Spinner className="size-3" /> : null}
            {starting === exercise.id ? "Starting…" : "Start this exercise"}
          </button>
        </article>
      ))}
    </div>
  );
}
