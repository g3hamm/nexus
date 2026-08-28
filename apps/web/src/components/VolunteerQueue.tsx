"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Spinner } from "@nexus/ui";

interface QueueEntry {
  readonly id: string;
  readonly name: string | null;
  readonly language: string;
  readonly languageName: string;
  readonly waitingSince?: string;
  readonly matchedAt?: string | null;
}

interface QueueResponse {
  readonly waiting: QueueEntry[];
  readonly active: QueueEntry[];
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
              <Card key={entry.id} padded={false} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-ink" dir="auto">
                      {entry.name ?? "Someone"}
                    </p>
                    <p className="text-ink-subtle text-sm">
                      {entry.languageName}
                      {entry.matchedAt ? ` · since ${timeAgo(entry.matchedAt)}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => router.push(`/volunteer/chat/${entry.id}`)}
                  >
                    Open
                  </Button>
                </div>
              </Card>
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
          <Card>
            <p className="text-ink-muted text-center">Nobody is waiting right now.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {data.waiting.map((entry) => (
              <Card key={entry.id} padded={false} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-ink" dir="auto">
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
                </div>
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
