"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CoverageState, CrisisResources } from "@nexus/core";

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

/**
 * Whether to show crisis resources, and which ones.
 *
 * Arrives on the transcript rather than over the realtime channel: a data
 * packet is spoofable and the polling fallback has to carry everything the
 * socket does. Someone on a failing mobile connection is not someone who
 * should miss this.
 */
export interface CrisisState {
  readonly active: boolean;
  readonly resources?: CrisisResources;
}

interface TranscriptResponse {
  readonly messages: TranscriptEntry[];
  readonly conversation: {
    id: string;
    status: string;
    matched: boolean;
    /** The other person's first name — a volunteer's, from a seeker's side. */
    peerName?: string | null;
  };
  readonly crisis?: CrisisState;
  readonly coverage?: { state: CoverageState } | null;
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
/**
 * How long a typing indicator survives without being renewed.
 *
 * Every source of these can die mid-thought — a browser tab closed while
 * "typing" was true, a serverless function killed between announcing the
 * practice partner and its reply. An indicator that never clears is worse
 * than none: it tells someone a person is still there when they are not.
 */
const TYPING_TTL_MS = 12_000;

/** Announce at most this often while someone keeps typing. */
const TYPING_THROTTLE_MS = 3_000;

interface TypingEvent {
  readonly type: "typing";
  readonly role: "seeker" | "volunteer" | "admin" | "system";
  readonly active: boolean;
}

/**
 * A typing event, or null for anything else.
 *
 * Everything on this channel is untrusted input from another browser, so this
 * never throws and never guesses. Null covers both "malformed" and "some other
 * event" — and both mean the same thing to the caller: go and refetch from the
 * server, which is the only thing that can change the transcript.
 */
function decodeTyping(payload: Uint8Array): TypingEvent | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
    if (typeof parsed !== "object" || parsed === null) return null;

    const event = parsed as Record<string, unknown>;
    if (event.type !== "typing") return null;
    if (typeof event.role !== "string" || typeof event.active !== "boolean") return null;

    return {
      type: "typing",
      role: event.role as TypingEvent["role"],
      active: event.active,
    };
  } catch {
    return null;
  }
}

export function useConversation(
  conversationId: string,
  viewerRole: "seeker" | "volunteer" = "seeker",
) {
  const [messages, setMessages] = useState<TranscriptEntry[]>([]);
  const [matched, setMatched] = useState(false);
  const [status, setStatus] = useState<string>("waiting");
  const [peerName, setPeerName] = useState<string | null>(null);
  const [crisis, setCrisis] = useState<CrisisState>({ active: false });
  const [coverage, setCoverage] = useState<CoverageState | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);

  const liveRoom = useRef<{
    localParticipant?: {
      publishData: (data: Uint8Array, options?: unknown) => Promise<void>;
    };
  } | null>(null);
  const typingExpiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnnounced = useRef(0);
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
      setPeerName(data.conversation.peerName ?? null);
      // Latches on. An incremental poll that arrives without it — an older
      // deploy, a truncated response — must not take the numbers away from
      // someone who is currently looking at them.
      if (data.crisis?.active) setCrisis(data.crisis);
      // Null once a volunteer picks the conversation up, which is the point:
      // the waiting copy disappears because the waiting is over.
      setCoverage(data.coverage?.state ?? null);

      if (data.messages.length > 0) {
        latestAt.current = data.messages[data.messages.length - 1]?.sentAt ?? null;
      }

      setMessages((current) => {
        if (!incremental) return data.messages;
        // Merge by id — the poll and the realtime nudge race constantly, and
        // both delivering the same message must not double it up.
        const seen = new Set(current.map((m) => m.id));
        const added = data.messages.filter((m) => !seen.has(m.id));
        // The message is the end of the typing. Clearing here rather than
        // waiting for a stop event means the indicator never overlaps the
        // thing it was predicting.
        if (added.some((m) => m.authorRole !== viewerRole)) {
          setPeerTyping(false);
          if (typingExpiry.current) clearTimeout(typingExpiry.current);
        }
        return added.length > 0 ? [...current, ...added] : current;
      });
      setLoading(false);
    },
    [conversationId, viewerRole],
  );

  const showPeerTyping = useCallback((active: boolean) => {
    if (typingExpiry.current) clearTimeout(typingExpiry.current);
    setPeerTyping(active);
    if (active) {
      typingExpiry.current = setTimeout(() => setPeerTyping(false), TYPING_TTL_MS);
    }
  }, []);

  /**
   * Tell the other side something is being written.
   *
   * Throttled, and deliberately fire-and-forget: a typing dot is the least
   * important thing on the screen and must never be able to interfere with
   * sending an actual message. A conversation with no realtime connection —
   * a restrictive network, a dropped socket — simply has no indicator, and
   * everything else still works over the polling fallback.
   */
  const notifyTyping = useCallback(() => {
    const participant = liveRoom.current?.localParticipant;
    if (!participant) return;

    const now = Date.now();
    if (now - lastAnnounced.current < TYPING_THROTTLE_MS) return;
    lastAnnounced.current = now;

    const payload = new TextEncoder().encode(
      JSON.stringify({ type: "typing", role: viewerRole, active: true }),
    );
    void participant
      .publishData(payload, { reliable: true, topic: "nexus" })
      .catch(() => {});
  }, [viewerRole]);

  // Never leave a timer running against an unmounted component.
  useEffect(() => {
    return () => {
      if (typingExpiry.current) clearTimeout(typingExpiry.current);
    };
  }, []);

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

        livekit.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
          // Typing is the one event acted on directly rather than treated as
          // a nudge to refetch. It is also the one event where a forged packet
          // is harmless: the worst a spoofer achieves is a dot that appears
          // for twelve seconds and then stops. Everything that alters the
          // transcript still comes from the server.
          const typing = decodeTyping(payload);
          if (typing) {
            if (typing.role !== viewerRole) showPeerTyping(typing.active);
            return;
          }

          void refresh(true);
        });
        livekit.on(RoomEvent.Disconnected, () => {
          setConnected(false);
          liveRoom.current = null;
        });

        await livekit.connect(url, token);
        if (disposed) {
          livekit.disconnect();
          return;
        }
        liveRoom.current = livekit as unknown as typeof liveRoom.current;
        setConnected(true);
      } catch {
        // The poll below covers us. Never surface this to a seeker.
        setConnected(false);
      }
    }

    void connect();
    return () => {
      disposed = true;
      liveRoom.current = null;
      room?.disconnect();
    };
  }, [conversationId, refresh, viewerRole, showPeerTyping]);

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

  return {
    messages,
    matched,
    status,
    peerName,
    connected,
    loading,
    crisis,
    coverage,
    peerTyping,
    notifyTyping,
    send,
    refresh,
  };
}
