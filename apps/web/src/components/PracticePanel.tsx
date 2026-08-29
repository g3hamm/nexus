"use client";

import { useState } from "react";
import Link from "next/link";
import type { PracticeDebrief, PracticeNote, PracticeReadiness } from "@nexus/core";
import { Spinner } from "@nexus/ui";

const READINESS: Record<PracticeReadiness, { label: string; note: string }> = {
  not_yet: {
    label: "Not yet",
    note: "Something here would have hurt a real person. Worth reading closely and trying this one again.",
  },
  with_support: {
    label: "With support",
    note: "Sound instincts and real gaps. Do this alongside someone experienced for a while.",
  },
  ready: {
    label: "Ready",
    note: "You handled a hard conversation without harm and with genuine skill.",
  },
};

export interface AcademyOrigin {
  readonly id: string;
  readonly title: string;
}

/**
 * The practice frame around a training conversation.
 *
 * Two jobs. It makes unmistakably clear that nobody is on the other end —
 * a volunteer who forgets this is one who might practise saying something
 * they would never say to a person — and it is where the debrief arrives.
 *
 * The debrief is deliberately not a score. A number invites volunteers to
 * optimise it and administrators to rank people by it, and this exists to
 * make someone better at sitting with a grieving stranger.
 */
export function PracticePanel({
  conversationId,
  title,
  academyModule = null,
}: {
  readonly conversationId: string;
  readonly title: string;
  /** The Academy module this exercise was started from, if it was. */
  readonly academyModule?: AcademyOrigin | null;
}) {
  const [debrief, setDebrief] = useState<PracticeDebrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/practice/${conversationId}/debrief`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // What the volunteer had just read. The server checks it against the
        // scenario before it steers the feedback, so a stale or wrong value
        // is dropped rather than believed.
        body: JSON.stringify(academyModule ? { academyModule: academyModule.id } : {}),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Could not put together your feedback.");
      }
      const body = (await response.json()) as { debrief: PracticeDebrief };
      setDebrief(body.debrief);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not put together your feedback.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <header className="border-line border-b pb-4">
        <p className="text-ink-subtle text-xs uppercase tracking-wide">
          {academyModule ? "Academy exercise" : "Practice"}
        </p>
        <h2 className="text-ink mt-1 font-serif text-lg">{title}</h2>
        {academyModule ? (
          <p className="text-ink-muted mt-1 text-sm leading-relaxed">
            From{" "}
            <Link
              href={`/volunteer/academy/${academyModule.id}`}
              className="underline underline-offset-2"
            >
              {academyModule.title}
            </Link>
            . Your feedback will be marked against it.
          </p>
        ) : null}
        <p className="text-ink-subtle mt-2 text-sm leading-relaxed">
          Nobody is on the other end. Nothing here is reviewed, flagged, or seen by anyone
          but you.
        </p>
      </header>

      {debrief ? (
        <Debrief debrief={debrief} academyModule={academyModule} />
      ) : (
        <div className="mt-5">
          <p className="text-ink-muted text-sm leading-relaxed">
            Take it as far as it goes. When you are finished — or when you are stuck,
            which is also worth reading about — ask for feedback.
          </p>
          {error ? <p className="text-danger mt-3 text-sm">{error}</p> : null}
          <button
            type="button"
            onClick={() => void finish()}
            disabled={loading}
            className="bg-accent text-accent-ink hover:bg-accent-hover mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[--radius-sm] px-4 py-2 text-sm disabled:opacity-60"
          >
            {loading ? <Spinner className="size-3" /> : null}
            {loading ? "Reading it back…" : "End and get feedback"}
          </button>
        </div>
      )}
    </div>
  );
}

function Debrief({
  debrief,
  academyModule,
}: {
  readonly debrief: PracticeDebrief;
  readonly academyModule: AcademyOrigin | null;
}) {
  const readiness = READINESS[debrief.readiness];

  return (
    <div className="mt-5 space-y-6">
      <p className="text-ink text-sm leading-relaxed">{debrief.summary}</p>

      {/* Harms first and never folded into "things to work on". Softening one
          into a growth point is exactly how it gets skimmed past. */}
      <NoteList title="This would have hurt someone" notes={debrief.harms} emphasis />
      <NoteList title="What you did well" notes={debrief.strengths} />
      <NoteList title="What to work on" notes={debrief.growth} />
      <NoteList title="Openings you did not take" notes={debrief.missed} />

      <section className="border-line border-t pt-4">
        <h3 className="text-ink font-serif">{readiness.label}</h3>
        <p className="text-ink-muted mt-1 text-sm leading-relaxed">{readiness.note}</p>
        <p className="text-ink-subtle mt-3 text-xs leading-relaxed">
          One conversation is thin evidence, and this is a reading rather than a verdict.
          Nobody else is shown it.
        </p>
        {/* Back to where they came from. Somebody who has just been told
            they made the mistake the module warned about should land on the
            module, not on a list of other conversations. */}
        <Link
          href={
            academyModule
              ? `/volunteer/academy/${academyModule.id}`
              : "/volunteer/practice"
          }
          className="text-ink-muted mt-4 inline-block text-sm underline underline-offset-2"
        >
          {academyModule ? `Back to ${academyModule.title}` : "Try another one"}
        </Link>
      </section>
    </div>
  );
}

function NoteList({
  title,
  notes,
  emphasis = false,
}: {
  readonly title: string;
  readonly notes: readonly PracticeNote[];
  readonly emphasis?: boolean;
}) {
  if (notes.length === 0) return null;

  return (
    <section>
      <h3
        className={
          emphasis
            ? "text-danger font-serif text-sm"
            : "text-ink-muted font-serif text-sm"
        }
      >
        {title}
      </h3>
      <ul className="mt-2 space-y-3">
        {notes.map((note) => (
          <li key={note.point} className="text-sm">
            <p className="text-ink leading-relaxed">{note.point}</p>
            {note.quote ? (
              <blockquote
                dir="auto"
                className="border-line-strong text-ink-muted mt-1.5 border-l-2 pl-3 italic leading-relaxed"
              >
                {note.quote}
              </blockquote>
            ) : null}
            <p className="text-ink-subtle mt-1 leading-relaxed">{note.why}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
