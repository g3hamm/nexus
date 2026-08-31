"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Spinner, cn } from "@nexus/ui";
import { ICON_PROPS } from "./CornerLink";
import { ScriptureText } from "./ScriptureText";
import { insertVerse } from "./verse-insert";

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
 * How often to quietly check for verses regenerated in the background.
 *
 * A plain GET here is a cache read once a full analysis already exists —
 * not a model call — which is what makes polling it cheap enough to skip
 * building a live bridge to the conversation's own poll for this.
 */
const POLL_MS = 15_000;

/**
 * The volunteer's sidebar.
 *
 * The full analysis — Understanding, discussion points — only regenerates
 * on the very first look at a conversation, or when the volunteer clicks
 * Update below. Verses are the one exception: they refresh automatically on
 * the server after every new seeker message (see `EnablementCacheService`),
 * cheaply, on a much smaller model, and this component's own poll just
 * notices that happened rather than causing it.
 */
export function EnablementSidebar({
  conversationId,
  seekerLanguage,
  language,
}: {
  readonly conversationId: string;
  /** The seeker's language, named in itself, for display only. */
  readonly seekerLanguage: string;
  /**
   * The volunteer's own language code — what the panel is written in, and
   * so what a reference in it has to be detected and looked up as. A code,
   * not an endonym: `seekerLanguage` above is the human-readable one.
   */
  readonly language: string;
}) {
  const [data, setData] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shared by the mount fetch, the poll, and Update: the first fetch for a
  // conversation can be a genuine multi-second model call, and without this
  // the poll firing mid-bootstrap would kick off a second one right behind it.
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch(`/api/conversations/${conversationId}/suggestions`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("failed");
      setData((await response.json()) as Suggestions);
      setError(null);
    } catch {
      setError("Could not load suggestions.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [conversationId]);

  const forceRefresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/suggestions/refresh`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error("failed");
      setData((await response.json()) as Suggestions);
      setError(null);
    } catch {
      setError("Could not load suggestions.");
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The quiet background check described above.
  useEffect(() => {
    const interval = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="text-panel-ink flex h-full flex-col gap-5 overflow-y-auto p-5">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-panel-ink font-serif text-lg">Guidance</h2>
          <Button
            variant="ghost-panel"
            size="sm"
            busy={refreshing}
            onClick={() => void forceRefresh()}
          >
            Update
          </Button>
        </div>
        <p className="text-panel-subtle mt-1 text-sm">
          They are writing in {seekerLanguage}.
        </p>
      </div>

      {error ? (
        <p className="text-panel-caution text-sm">{error}</p>
      ) : loading && !data ? (
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
          <Verses verses={data.verses} language={language} />
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

/**
 * Draggable onto the composer for a quick mention — dropped as plain text,
 * the reference on its own already renders inline and hoverable once sent
 * (see `ScriptureText`), so nothing here needs to format it specially.
 * Desktop only by nature: on a phone the conversation and this panel are
 * two separate swipe pages, never both on screen to drag between.
 */
function Verses({
  verses,
  language,
}: {
  readonly verses: Suggestions["verses"];
  readonly language: string;
}) {
  if (verses.length === 0) return null;

  return (
    <Section title="Scripture">
      <ul className="space-y-3">
        {verses.map((verse) => (
          <li
            key={verse.reference}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", verse.reference);
              e.dataTransfer.effectAllowed = "copy";
            }}
            className="bg-panel-raised rounded-md p-3"
          >
            <div className="flex items-center gap-1.5">
              {/* The handle is the draggable affordance and stays honest
                  about it: dragging is a desktop gesture, so it is the
                  handle that shows the grab cursor rather than the whole
                  card, which on a phone can only be tapped. */}
              <DragHandleIcon className="text-panel-subtle hidden cursor-grab lg:block" />
              {/* The reference is the passage: tapping it opens the full
                  text. It used to be plain, so a volunteer could see which
                  verse was suggested but not what it actually said without
                  leaving the conversation to look it up. */}
              <ScriptureText
                text={verse.reference}
                language={language}
                className="font-medium"
                linkClassName="text-panel-accent decoration-panel-accent/40 hover:decoration-panel-accent underline decoration-dotted underline-offset-2 transition-colors"
              />
            </div>
            {verse.preview ? (
              <p className="border-panel-line text-panel-muted mt-1 border-l-2 pl-3 text-sm italic">
                {verse.preview}
              </p>
            ) : null}
            <p className="text-panel-muted mt-2 text-sm">{verse.rationale}</p>
            {/* Dragging is unusable on a phone, where the panel and the
                conversation are separate swipe pages and there is nowhere to
                drag to. This does the same job with a tap, and is the only
                way in on touch. */}
            <button
              type="button"
              onClick={() => insertVerse(verse.reference)}
              className="border-panel-line text-panel-muted hover:text-panel-ink hover:border-panel-subtle ease-calm mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors duration-200"
            >
              Add to message
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DragHandleIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      {...ICON_PROPS}
      aria-hidden="true"
      className={
        className ? `${ICON_PROPS.className} ${className}` : ICON_PROPS.className
      }
    >
      {[4, 8, 12].flatMap((y) =>
        [5, 10].map((x) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={1}
            fill="currentColor"
            stroke="none"
          />
        )),
      )}
    </svg>
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
