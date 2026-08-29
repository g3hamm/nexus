"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Spinner, cn, field } from "@nexus/ui";
import { CATEGORY_LABEL, SEVERITY_STYLE, SUBJECT_LABEL, timeAgo } from "./severity";

interface Line {
  readonly id: string;
  readonly authorRole: string;
  readonly originalText: string;
  readonly originalLanguage: string;
  readonly englishText: string | null;
  readonly sentAt: string;
  readonly flagged: boolean;
}

interface Flag {
  readonly id: string;
  readonly category: string | null;
  readonly severity: string;
  readonly subject: string;
  readonly rationale: string;
  readonly recommended: string;
  readonly confidence: number;
  readonly evidenceMessageIds: string[];
  readonly status: string;
  readonly raisedAt: string;
  readonly reviewNote: string | null;
}

interface Review {
  readonly conversation: {
    id: string;
    status: string;
    seekerLanguageName: string;
    startedAt: string;
    endedAt: string | null;
    retainUntil: string | null;
  } | null;
  readonly lines: Line[];
  readonly flags: Flag[];
}

export function TranscriptReview({
  conversationId,
}: {
  readonly conversationId: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/conversations/${conversationId}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("failed");
      setData((await response.json()) as Review);
    } catch {
      setError("Could not load this conversation.");
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="text-danger text-sm">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="text-ink-subtle" />
      </div>
    );
  }

  const evidence = new Set(data.flags.flatMap((f) => f.evidenceMessageIds));
  const open = data.flags.filter((f) => f.status === "open" || f.status === "reviewing");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-ink font-serif text-xl">Conversation under review</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Seeker writing in{" "}
          {data.conversation?.seekerLanguageName ?? "an unknown language"}
          {" · "}
          {data.conversation?.status}
          {data.conversation?.retainUntil === null ? " · retained pending review" : ""}
        </p>
        <p className="text-ink-subtle mt-2 text-xs">
          Your opening of this transcript has been recorded in the audit log.
        </p>
      </div>

      {open.map((flag) => (
        <FlagDecision
          key={flag.id}
          flag={flag}
          onResolved={() => {
            void load();
            router.refresh();
          }}
        />
      ))}

      <section>
        <h2 className="text-ink-subtle mb-3 text-sm font-medium uppercase tracking-wide">
          Transcript
        </h2>
        <div className="flex flex-col gap-3">
          {data.lines.map((line) => (
            <div
              key={line.id}
              className={cn(
                "rounded-md border p-3",
                evidence.has(line.id)
                  ? "border-caution/50 bg-surface"
                  : "border-line bg-surface-sunken",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ink-subtle text-xs uppercase tracking-wide">
                  {line.authorRole}
                  {evidence.has(line.id) ? " · cited by the judge" : ""}
                </span>
                <span className="text-ink-subtle shrink-0 text-xs">
                  {timeAgo(line.sentAt)}
                </span>
              </div>
              {/* The original always shows. A machine translation is an opinion,
                  and when a conversation goes wrong it may be the culprit. */}
              <p dir="auto" className="text-ink mt-1 whitespace-pre-wrap break-words">
                {line.originalText}
              </p>
              {line.englishText ? (
                <p className="border-line-strong text-ink-muted mt-2 border-l-2 pl-3 text-sm">
                  {line.englishText}
                </p>
              ) : null}
            </div>
          ))}
          {data.lines.length === 0 ? (
            <p className="text-ink-subtle text-sm">Nothing was said.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function FlagDecision({
  flag,
  onResolved,
}: {
  readonly flag: Flag;
  readonly onResolved: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"upheld" | "dismissed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(decision: "upheld" | "dismissed") {
    if (note.trim().length === 0) {
      setError("Add a short note explaining your decision.");
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      const response = await fetch(`/api/admin/flags/${flag.id}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() }),
      });
      if (!response.ok) throw new Error("failed");
      onResolved();
    } catch {
      setError("Could not save that. Please try again.");
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className={cn("font-medium", SEVERITY_STYLE[flag.severity])}>
          {flag.category ? (CATEGORY_LABEL[flag.category] ?? flag.category) : "Concern"}
        </h2>
        <span className="text-ink-subtle shrink-0 text-xs">{timeAgo(flag.raisedAt)}</span>
      </div>

      <p className="text-ink-muted mt-1 text-sm">
        About {SUBJECT_LABEL[flag.subject] ?? flag.subject} · severity {flag.severity} ·
        the judge suggested {flag.recommended.replace(/_/g, " ")}
      </p>

      <p className="text-ink mt-3">{flag.rationale}</p>

      {flag.confidence < 0.6 ? (
        <p className="text-ink-subtle mt-2 text-xs">
          The judge was not confident about this ({Math.round(flag.confidence * 100)}%).
          Weigh it accordingly.
        </p>
      ) : null}

      <label
        htmlFor={`note-${flag.id}`}
        className="text-ink mt-5 block text-sm font-medium"
      >
        Your decision, and why
      </label>
      <textarea
        id={`note-${flag.id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What you concluded, and what you did about it."
        className={field("sm", "mt-1.5 resize-none")}
      />

      {error ? (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-3">
        <Button
          variant="quiet"
          busy={busy === "dismissed"}
          onClick={() => void resolve("dismissed")}
        >
          Dismiss
        </Button>
        <Button
          variant="danger"
          busy={busy === "upheld"}
          onClick={() => void resolve("upheld")}
        >
          Uphold
        </Button>
      </div>

      <p className="text-ink-subtle mt-3 text-xs">
        Once every flag here is reviewed, this conversation goes back on a retention clock
        — 90 days if dismissed, a year if upheld.
      </p>
    </Card>
  );
}
