"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium",
        tint.bg,
        tint.ink,
      )}
    >
      {initialFor(name)}
    </span>
  );
}

export function VolunteerQueue() {
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

  if (!data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="text-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {data.active.length > 0 ? (
        <section>
          <h2 className="text-ink-subtle mb-3 text-sm font-medium uppercase tracking-wide">
            Your conversations
          </h2>
          <div className="flex flex-col gap-3">
            {data.active.map((entry) => (
              <Link
                key={entry.id}
                href={`/volunteer/chat/${entry.id}`}
                className="border-line bg-surface shadow-soft ease-calm flex items-center gap-3 rounded-lg border p-4 transition-colors duration-200 hover:border-line-strong"
              >
                <Avatar id={entry.id} name={entry.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-ink truncate font-medium" dir="auto">
                      {entry.name ?? "Someone"}
                    </p>
                    <span className="bg-positive/15 text-positive shrink-0 rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
                      Active
                    </span>
                  </div>
                  <p className="text-ink-subtle text-sm">
                    {entry.languageName}
                    {entry.matchedAt ? ` · since ${timeAgo(entry.matchedAt)}` : ""}
                  </p>
                  {entry.lastMessage ? (
                    <p className="text-ink-muted mt-1 truncate text-sm" dir="auto">
                      {entry.lastMessage}
                    </p>
                  ) : null}
                </div>
                <ChevronRightIcon className="text-ink-subtle" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-ink-subtle mb-3 text-sm font-medium uppercase tracking-wide">
          Waiting to talk
        </h2>

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
          <div className="flex flex-col gap-3">
            {data.waiting.map((entry) => (
              <Card key={entry.id} padded={false} className="flex items-center gap-3 p-4">
                <Avatar id={entry.id} name={entry.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate" dir="auto">
                    {entry.name ?? "Someone"}
                  </p>
                  <p className="text-ink-subtle text-sm">
                    {entry.languageName}
                    {entry.waitingSince ? ` · waiting ${timeAgo(entry.waitingSince)}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  busy={claiming === entry.id}
                  onClick={() => void claim(entry.id)}
                >
                  Talk with them
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "less than a minute";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
