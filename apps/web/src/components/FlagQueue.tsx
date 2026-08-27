"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, Spinner, cn } from "@nexus/ui";
import { CATEGORY_LABEL, SEVERITY_STYLE, SUBJECT_LABEL, timeAgo } from "./severity";

interface Flag {
  readonly id: string;
  readonly conversationId: string;
  readonly category: string | null;
  readonly severity: string;
  readonly subject: string;
  readonly rationale: string;
  readonly recommended: string;
  readonly confidence: number;
  readonly evidenceCount: number;
  readonly status: string;
  readonly raisedAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export function FlagQueue() {
  const [data, setData] = useState<{ open: Flag[]; resolved: Flag[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/flags", { cache: "no-store" });
      if (!response.ok) throw new Error("failed");
      setData((await response.json()) as { open: Flag[]; resolved: Flag[] });
    } catch {
      setError("Could not load the queue.");
    }
  }, []);

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

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-ink-subtle mb-3 text-sm font-medium uppercase tracking-wide">
          Awaiting review
        </h2>

        {data.open.length === 0 ? (
          <Card>
            <p className="text-ink-muted text-center">
              Nothing is waiting. Conversations are being watched.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.open.map((flag) => (
              <li key={flag.id}>
                <Link
                  href={`/admin/conversations/${flag.conversationId}`}
                  className="border-line bg-surface shadow-soft hover:border-line-strong block rounded-lg border p-4 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className={cn("font-medium", SEVERITY_STYLE[flag.severity])}>
                      {flag.category
                        ? (CATEGORY_LABEL[flag.category] ?? flag.category)
                        : "Concern"}
                    </span>
                    <span className="text-ink-subtle shrink-0 text-xs">
                      {timeAgo(flag.raisedAt)}
                    </span>
                  </div>
                  <p className="text-ink-muted mt-1 text-sm">
                    About {SUBJECT_LABEL[flag.subject] ?? flag.subject} · {flag.severity}
                    {flag.confidence < 0.6 ? " · low confidence" : ""}
                  </p>
                  <p className="text-ink mt-2 line-clamp-2 text-sm">{flag.rationale}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.resolved.length > 0 ? (
        <section>
          <h2 className="text-ink-subtle mb-3 text-sm font-medium uppercase tracking-wide">
            Recently reviewed
          </h2>
          <ul className="flex flex-col gap-2">
            {data.resolved.map((flag) => (
              <li
                key={flag.id}
                className="border-line bg-surface-sunken rounded-md border p-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-ink">
                    {flag.category
                      ? (CATEGORY_LABEL[flag.category] ?? flag.category)
                      : "Concern"}
                    {" — "}
                    <span className="text-ink-muted">
                      {flag.status === "upheld" ? "upheld" : "dismissed"}
                    </span>
                  </span>
                  <Link
                    href={`/admin/conversations/${flag.conversationId}`}
                    className="text-ink-subtle shrink-0 text-xs underline-offset-2 hover:underline"
                  >
                    open
                  </Link>
                </div>
                {flag.reviewNote ? (
                  <p className="text-ink-muted mt-1">{flag.reviewNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
