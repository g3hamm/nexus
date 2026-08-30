"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, Card, Spinner, cn } from "@nexus/ui";
import { ChevronRightIcon } from "./CornerLink";

interface QueueEntry {
  readonly id: string;
  readonly name: string | null;
  readonly language: string;
  readonly languageName: string;
  readonly waitingSince?: string;
  readonly matchedAt?: string | null;
  readonly lastMessage?: string | null;
}

interface QueueResponse {
  readonly waiting: QueueEntry[];
  readonly active: QueueEntry[];
}

/**
 * Which of the two speakers' existing colours a row's avatar borrows —
 * stable per conversation (hashed from its id, not random per render), and
 * reusing the same seeker/volunteer bubble tokens the chat view already
 * uses rather than inventing a third palette just for this circle.
 */
const AVATAR_TINTS = [
  { bg: "bg-seeker-bubble", ink: "text-seeker-ink" },
  { bg: "bg-volunteer-bubble", ink: "text-volunteer-ink" },
] as const;

function avatarTint(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % AVATAR_TINTS.length;
  return AVATAR_TINTS[hash] ?? AVATAR_TINTS[0];
}

function initialFor(name: string | null): string {
  return name?.trim().charAt(0).toUpperCase() || "?";
}

function Avatar({ id, name }: { readonly id: string; readonly name: string | null }) {
  const tint = avatarTint(id);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full font-medium",
        tint.bg,
        tint.ink,
      )}
    >
      {initialFor(name)}
    </span>
  );
}

function SectionHeading({ children }: { readonly children: ReactNode }) {
  return (
    <h2 className="text-ink-subtle mb-3 text-sm font-medium uppercase tracking-wide">
      {children}
    </h2>
  );
}

export function VolunteerQueue({ children }: { readonly children?: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<QueueResponse | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/volunteer/queue", { cache: "no-store" });
    if (response.ok) setData((await response.json()) as QueueResponse);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function claim(conversationId: string) {
    setClaiming(conversationId);
    setNotice(null);

    const response = await fetch("/api/volunteer/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });

    if (response.ok) {
      router.push(`/volunteer/chat/${conversationId}`);
      return;
    }

    // Losing the race is ordinary, not an error worth alarming anyone about.
    if (response.status === 409) {
      setNotice("Another volunteer just took that one.");
      await refresh();
    } else {
      setNotice("Could not open that conversation. Please try again.");
    }
    setClaiming(null);
  }

  return (
    <div className="flex flex-col gap-10">
      {/* The spinner covers only this section, never the whole component.
          `children` — the promo cards — are static and belong to the page
          whether or not a queue fetch has landed yet, and blanking them on
          every load made the page jump. */}
      {data === null ? (
        <div className="flex justify-center py-12">
          <Spinner className="text-ink-subtle" />
        </div>
      ) : data.active.length > 0 ? (
        <section>
          <SectionHeading>Your conversations</SectionHeading>
          {/* One card with hairline rules between rows rather than a stack
              of separate cards: these are one list, and reading them as a
              list is what a volunteer with four conversations needs. */}
          <Card padded={false} className="divide-line divide-y overflow-hidden">
            {data.active.map((entry) => (
              <Link
                key={entry.id}
                href={`/volunteer/chat/${entry.id}`}
                className="hover:bg-surface-sunken ease-calm flex items-center gap-4 p-5 transition-colors duration-200"
              >
                <Avatar id={entry.id} name={entry.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate text-lg font-semibold" dir="auto">
                    {entry.name ?? "Someone"}
                  </p>
                  <p className="text-ink-subtle truncate text-sm">
                    {entry.languageName}
                    {entry.matchedAt ? ` · ${timeAgo(entry.matchedAt)}` : ""}
                  </p>
                  {entry.lastMessage ? (
                    <p className="text-ink-muted mt-1 truncate" dir="auto">
                      {entry.lastMessage}
                    </p>
                  ) : null}
                </div>
                <span className="bg-active/15 text-active hidden shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider sm:inline-block">
                  Active
                </span>
                <ChevronRightIcon className="text-ink-subtle size-5" />
              </Link>
            ))}
          </Card>
        </section>
      ) : null}

      {children}

      {data === null ? null : (
        <section>
          <SectionHeading>Waiting to talk</SectionHeading>

          {notice ? <p className="text-ink-muted mb-3 text-sm">{notice}</p> : null}

          {data.waiting.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-10 text-center">
              <Image
                src="/park-bench.png"
                alt=""
                width={160}
                height={120}
                className="h-28 w-auto"
              />
              <p className="text-ink font-medium">No one is waiting right now.</p>
              <p className="text-ink-subtle text-sm">
                We&rsquo;ll notify you here when a new seeker is ready to talk.
              </p>
            </Card>
          ) : (
            <Card padded={false} className="divide-line divide-y overflow-hidden">
              {data.waiting.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 p-5">
                  <Avatar id={entry.id} name={entry.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-lg font-semibold" dir="auto">
                      {entry.name ?? "Someone"}
                    </p>
                    <p className="text-ink-subtle truncate text-sm">
                      {entry.languageName}
                      {entry.waitingSince ? ` · ${timeAgo(entry.waitingSince)}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    busy={claiming === entry.id}
                    onClick={() => void claim(entry.id)}
                  >
                    Talk with them
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Compact by design — "51h ago" rather than "since 51 hours".
 *
 * This shares one line with a language name in a list read at a glance,
 * where the rough order of the figure matters far more than the figure,
 * and where anything longer truncated away the message preview beside it
 * on a phone. The waiting rows say "3m ago" too rather than "waiting 3m":
 * the section heading above them already supplies that word.
 */
function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return "just now";
  return hours < 1 ? `${minutes}m ago` : `${hours}h ago`;
}
