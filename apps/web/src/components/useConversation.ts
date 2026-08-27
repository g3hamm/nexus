"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TranscriptEntry {
  readonly id: string;
  readonly authorRole: "seeker" | "volunteer" | "admin" | "system";
  readonly text: string;
  readonly language: string;
  readonly originalText: string;
  readonly originalLanguage: string;
  readonly wasTranslated: boolean;
  readonly translationUnavailable: boolean;
  readonly sentAt: string;
}

interface TranscriptResponse {
  readonly messages: TranscriptEntry[];
  readonly conversation: { id: string; status: string; matched: boolean };
}

/**
 * Live transcript for one conversation.
 *
 * Two paths deliberately, not one. The realtime channel makes messages land
 * instantly; a slow poll underneath it guarantees they land at all. Seekers
 * are frequently on unreliable mobile networks behind restrictive middleboxes,
 * and a dropped WebSocket must degrade to "slightly delayed" rather than to
 * "the conversation appears to have stopped".
 */
export function useConversation(conversationId: string) {
  const [messages, setMessages] = useState<TranscriptEntry[]>([]);
  const [matched, setMatched] = useState(false);
  const [status, setStatus] = useState<string>("waiting");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const latestAt = useRef<string | null>(null);

  const refresh = useCallback(
    async (incremental: boolean) => {
      const url = new URL(
        `/api/conversations/${conversationId}/messages`,
        window.location.origin,
      );
      if (incremental && latestAt.current)
        url.searchParams.set("after", latestAt.current);

      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return;

      const data = (await response.json()) as TranscriptResponse;
      setMatched(data.conversation.matched);
      setStatus(data.conversation.status);

      if (data.messages.length > 0) {
        latestAt.current = data.messages[data.messages.length - 1]?.sentAt ?? null;
      }

      setMessages((current) => {
        if (!incremental) return data.messages;
        // Merge by id — the poll and the realtime nudge race constantly, and
        // both delivering the same message must not double it up.
        const seen = new Set(current.map((m) => m.id));
        const added = data.messages.filter((m) => !seen.has(m.id));
        return added.length > 0 ? [...current, ...added] : current;
      });
      setLoading(false);
    },
    [conversationId],
  );

  // Initial load.
  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  // Realtime nudges. The event says "something happened"; the transcript is
  // always refetched from the server, so a spoofed data packet cannot inject
  // a message into anyone's view.
  useEffect(() => {
    let disposed = false;
    let room: { disconnect: () => void } | null = null;

    async function connect() {
      try {
        const response = await fetch(`/api/conversations/${conversationId}/token`, {
          method: "POST",
        });
        if (!response.ok || disposed) return;

        const { token, url } = (await response.json()) as {
          token: string;
          url: string;
        };
        if (!url.startsWith("ws") || disposed) return;

        const { Room, RoomEvent } = await import("livekit-client");
        const livekit = new Room();
        room = livekit;

        livekit.on(RoomEvent.DataReceived, () => void refresh(true));
        livekit.on(RoomEvent.Disconnected, () => setConnected(false));

        await livekit.connect(url, token);
        if (disposed) {
          livekit.disconnect();
          return;
        }
        setConnected(true);
      } catch {
        // The poll below covers us. Never surface this to a seeker.
        setConnected(false);
      }
    }

    void connect();
    return () => {
      disposed = true;
      room?.disconnect();
    };
  }, [conversationId, refresh]);

  // The safety net. Slower while realtime is healthy, brisk when it is not.
  useEffect(() => {
    const interval = setInterval(() => void refresh(true), connected ? 15_000 : 3_000);
    return () => clearInterval(interval);
  }, [refresh, connected]);

  const send = useCallback(
    async (text: string) => {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("send failed");
      await refresh(true);
    },
    [conversationId, refresh],
  );

  return { messages, matched, status, connected, loading, send, refresh };
}
