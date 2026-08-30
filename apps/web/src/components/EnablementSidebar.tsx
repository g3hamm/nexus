"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Spinner, cn } from "@nexus/ui";

type Intent = "question" | "bridge" | "clarification" | "caution" | "encouragement";

interface Suggestions {
  readonly ready: boolean;
  readonly verses: {
    reference: string;
    rationale: string;
    preview: string | null;
  }[];
  readonly discussionPoints: { text: string; intent: Intent }[];
  readonly understanding?: {
    summary: string;
    apparentNeed: string;
    cautions: string[];
    confidence: number;
  };
  readonly sources: { title: string; source: string; score: number }[];
  readonly generatedAt?: string;
}

/**
 * The volunteer's sidebar.
 *
 * Refreshes only when asked. An auto-refreshing panel would cost a model call
 * every time anyone typed, and — worse — would keep changing what it says
 * underneath someone who is mid-thought. The volunteer decides when they want
 * another look.
 */
export function EnablementSidebar({
  conversationId,
  seekerLanguage,
}: {
  readonly conversationId: string;
  readonly seekerLanguage: string;
}) {
  const [data, setData] = useState<Suggestions | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/suggestions`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("failed");
      setData((await response.json()) as Suggestions);
    } catch {
      setError("Could not load suggestions.");
    } finally {
      setBusy(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="text-panel-ink flex h-full flex-col gap-5 overflow-y-auto p-5">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-panel-ink font-serif text-lg">Guidance</h2>
          <Button variant="ghost-panel" size="sm" busy={busy} onClick={() => void load()}>
            Update
          </Button>
        </div>
        <p className="text-panel-subtle mt-1 text-sm">
          They are writing in {seekerLanguage}.
        </p>
      </div>

      {error ? (
        <p className="text-panel-caution text-sm">{error}</p>
      ) : busy && !data ? (
        <div className="flex justify-center py-8">
          <Spinner className="text-panel-subtle" />
        </div>
      ) : !data?.ready ? (
        <p className="text-panel-subtle text-sm">
          Once they have said something, suggestions will appear here.
        </p>
      ) : (
        <>
          <Understanding understanding={data.understanding} />
          <Verses verses={data.verses} />
          <Points points={data.discussionPoints} />
          <Sources sources={data.sources} />
        </>
      )}

      <p className="text-panel-subtle mt-auto pt-4 text-xs">
        Nothing here is sent for you. You decide what to say.
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-panel-subtle mb-2 text-xs font-medium uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Understanding({
  understanding,
}: {
  readonly understanding: Suggestions["understanding"];
}) {
  if (!understanding?.summary) return null;

  // Shown as a hedge, not a verdict. A volunteer should be able to disagree
  // with this at a glance rather than being quietly steered by it.
  const strength =
    understanding.confidence >= 0.7
      ? "Fairly confident"
      : understanding.confidence >= 0.4
        ? "A guess"
        : "Very unsure";

  return (
    <Section title="Understanding">
      <div className="bg-panel-raised rounded-md p-3">
        <p className="text-panel-ink text-sm">{understanding.summary}</p>
        {understanding.apparentNeed ? (
          <p className="text-panel-muted mt-2 text-sm">
            <span className="text-panel-subtle">What they seem to need: </span>
            {understanding.apparentNeed}
          </p>
        ) : null}
        {understanding.cautions.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {understanding.cautions.map((caution) => (
              <li key={caution} className="text-panel-muted text-sm">
                {caution}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-panel-subtle mt-3 text-xs">
          {strength} — your read matters more.
        </p>
      </div>
    </Section>
  );
}

function Verses({ verses }: { readonly verses: Suggestions["verses"] }) {
  if (verses.length === 0) return null;

  return (
    <Section title="Scripture">
      <ul className="space-y-3">
        {verses.map((verse) => (
          <li key={verse.reference} className="bg-panel-raised rounded-md p-3">
            <p className="text-panel-ink font-medium">{verse.reference}</p>
            {verse.preview ? (
              <p className="border-panel-line text-panel-muted mt-1 border-l-2 pl-3 text-sm italic">
                {verse.preview}
              </p>
            ) : null}
            <p className="text-panel-muted mt-2 text-sm">{verse.rationale}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const INTENT_LABEL: Record<Intent, string> = {
  question: "Ask",
  bridge: "Bridge",
  clarification: "Clarify",
  caution: "Careful",
  encouragement: "Affirm",
};

function Points({ points }: { readonly points: Suggestions["discussionPoints"] }) {
  if (points.length === 0) return null;

  // Cautions first. "Do not say this" is more urgent than "you could ask this",
  // and a volunteer skimming the panel should hit it before anything else.
  const ordered = [...points].sort(
    (a, b) => Number(b.intent === "caution") - Number(a.intent === "caution"),
  );

  return (
    <Section title="Worth saying next">
      <ul className="space-y-2">
        {ordered.map((point) => (
          <li
            key={point.text}
            className={cn(
              "rounded-md p-3 text-sm",
              point.intent === "caution"
                ? "border-panel-caution/50 bg-panel-raised border"
                : "bg-panel-raised",
            )}
          >
            <span
              className={cn(
                "mb-1 block text-xs uppercase tracking-wide",
                point.intent === "caution" ? "text-panel-caution" : "text-panel-subtle",
              )}
            >
              {INTENT_LABEL[point.intent]}
            </span>
            <span className="text-panel-ink">{point.text}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Sources({ sources }: { readonly sources: Suggestions["sources"] }) {
  if (sources.length === 0) {
    return (
      <p className="text-panel-subtle text-xs">
        Nothing in the knowledge base matched this closely, so the suggestions above are
        more tentative than usual.
      </p>
    );
  }

  return (
    <Section title="Drawn from">
      <ul className="space-y-1">
        {sources.map((source) => (
          <li
            key={`${source.title}-${source.source}`}
            className="text-panel-subtle text-xs"
          >
            {source.title} — {source.source}
          </li>
        ))}
      </ul>
    </Section>
  );
}
