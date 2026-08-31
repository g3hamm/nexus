"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { endonym, type PracticeDifficulty } from "@nexus/core";
import { Spinner } from "@nexus/ui";

export interface ScenarioSummary {
  readonly id: string;
  readonly title: string;
  readonly premise: string;
  readonly difficulty: PracticeDifficulty;
  readonly language: string;
  readonly competencies: readonly string[];
  readonly reachesCrisis: boolean;
}

const DIFFICULTY_LABEL: Record<PracticeDifficulty, string> = {
  searching: "Searching",
  sceptical: "Arguing",
  hostile: "Hostile",
};

/**
 * Choosing what to practise.
 *
 * The premise is shown and the persona never is. A volunteer who has read the
 * character notes practises confirming a backstory they already know, which
 * is the opposite of the skill — most of the exercise is working out who you
 * are actually talking to.
 */
export function ScenarioPicker({
  scenarios,
}: {
  readonly scenarios: readonly ScenarioSummary[];
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
        throw new Error(body.error?.message ?? "Could not start that session.");
      }

      const { conversationId } = (await response.json()) as { conversationId: string };
      router.push(`/volunteer/chat/${conversationId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start that session.");
      setStarting(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-danger text-sm">{error}</p> : null}

      {scenarios.map((scenario) => (
        <article
          key={scenario.id}
          className="border-line bg-surface shadow-soft rounded-lg border p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-ink font-serif text-lg">{scenario.title}</h2>
            <span className="text-ink-subtle text-xs">
              {DIFFICULTY_LABEL[scenario.difficulty]} · {endonym(scenario.language)}
            </span>
          </div>

          <p className="text-ink-muted mt-2 text-sm leading-relaxed">
            {scenario.premise}
          </p>

          {scenario.reachesCrisis ? (
            <p className="text-ink-subtle border-line-strong mt-3 border-l-2 pl-3 text-sm leading-relaxed">
              This one reaches a disclosure of self-harm. It is here so that the
              first time you meet it is not the first time it is real. You can
              stop at any point, and nobody is alerted.
            </p>
          ) : null}

          <ul className="text-ink-subtle mt-3 space-y-1 text-sm">
            {scenario.competencies.map((competency) => (
              <li key={competency}>— {competency}</li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => void start(scenario.id)}
            disabled={starting !== null}
            className="bg-practice-deep ease-calm mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
          >
            {starting === scenario.id ? <Spinner className="size-3" /> : null}
            {starting === scenario.id ? "Starting…" : "Start"}
          </button>
        </article>
      ))}
    </div>
  );
}
