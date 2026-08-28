"use client";

import { useEffect, useRef } from "react";
import { INTERNATIONAL_DIRECTORY, type CoverageState } from "@nexus/core";
import { Spinner } from "@nexus/ui";
import { Composer } from "./Composer";
import { CrisisCard } from "./CrisisCard";
import { MessageList } from "./MessageList";
import { useConversation } from "./useConversation";

/**
 * The conversation, for either side.
 *
 * The same component serves seeker and volunteer. The only differences are
 * which bubbles align right and what the waiting state says, which keeps the
 * two experiences genuinely identical rather than accidentally divergent.
 */
export function ChatWindow({
  conversationId,
  viewerRole,
  peerName,
}: {
  readonly conversationId: string;
  readonly viewerRole: "seeker" | "volunteer";
  /** What the other person asked to be called, when they said. */
  readonly peerName?: string | null | undefined;
}) {
  const { messages, matched, status, loading, crisis, coverage, peerTyping, notifyTyping, send } =
    useConversation(conversationId, viewerRole);
  const sentPending = useRef(false);

  // Deliver the message typed on the landing page, now that a conversation
  // exists to put it in.
  useEffect(() => {
    if (viewerRole !== "seeker" || sentPending.current || loading) return;
    const key = `nexus:pending:${conversationId}`;
    const pending = sessionStorage.getItem(key);
    if (!pending) return;

    sentPending.current = true;
    sessionStorage.removeItem(key);
    void send(pending).catch(() => {
      sessionStorage.setItem(key, pending);
      sentPending.current = false;
    });
  }, [conversationId, viewerRole, loading, send]);

  const ended = status === "ended" || status === "terminated";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col px-4 py-4 sm:px-6">
      <header className="border-line flex items-center justify-between border-b pb-4">
        <span className="text-ink font-serif text-lg" dir="auto">
          {viewerRole === "volunteer" ? (peerName ?? "Someone") : "Nexus"}
        </span>
        {viewerRole === "seeker" ? (
          <WaitingIndicator matched={matched} ended={ended} coverage={coverage} />
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="text-ink-subtle" />
          </div>
        ) : (
          <>
            <MessageList messages={messages} viewerRole={viewerRole} />
            {peerTyping ? <TypingIndicator /> : null}
          </>
        )}
      </div>

      <div className="border-line border-t pt-4">
        {crisis.active && crisis.resources ? (
          <CrisisCard resources={crisis.resources} conversationId={conversationId} />
        ) : null}
        {viewerRole === "seeker" && !matched && !ended && coverage === "closed" ? (
          <NobodyOnNote showHelpline={!crisis.active} />
        ) : null}
        {ended ? (
          <p className="text-ink-muted py-2 text-center text-sm">
            This conversation has ended.
          </p>
        ) : (
          <Composer onSend={send} onTyping={notifyTyping} disabled={ended} />
        )}
      </div>
    </div>
  );
}

/**
 * Three dots, on the other person's side of the conversation.
 *
 * It matters more here than in an ordinary chat app. Every message crosses a
 * translation round-trip, so the gap between someone finishing their sentence
 * and it appearing is seconds rather than milliseconds — long enough that
 * silence reads as a broken app rather than as a person thinking. This is the
 * difference between "they are still there" and "this has stopped working".
 *
 * It pulses rather than bounces. The rest of this interface is deliberately
 * still, and a jaunty animation is the wrong register for a conversation
 * someone may be having on the worst day of their life.
 */
function TypingIndicator() {
  return (
    <div className="mt-4 flex justify-start" aria-live="polite">
      <span className="sr-only">The other person is writing</span>
      <div
        aria-hidden="true"
        className="bg-seeker-bubble flex items-center gap-1.5 rounded-2xl px-4 py-3.5"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="bg-ink-subtle size-1.5 animate-pulse rounded-full"
            style={{ animationDelay: `${i * 200}ms`, animationDuration: "1.4s" }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * What a seeker sees while nobody has picked up yet.
 *
 * It never says "you are number 4 in the queue" or shows an estimated wait.
 * Someone who has just written down something difficult should not then be
 * given a reason to leave.
 *
 * It also never spins when nothing is happening. "Finding someone to talk
 * with you", shown at three in the morning with the rota empty, is the
 * software pretending to work — and a person who eventually realises that is
 * a person who has learned this place cannot be trusted with the thing they
 * just typed. The spinner is reserved for a search that is really running.
 */
function WaitingIndicator({
  matched,
  ended,
  coverage,
}: {
  readonly matched: boolean;
  readonly ended: boolean;
  readonly coverage: CoverageState | null;
}) {
  if (ended) return null;
  if (matched) {
    return (
      <span className="text-ink-muted flex items-center gap-2 text-sm">
        <span aria-hidden="true" className="bg-positive size-2 rounded-full" />
        Someone is here with you
      </span>
    );
  }

  if (coverage === "closed") {
    return (
      <span className="text-ink-muted flex items-center gap-2 text-sm">
        <span aria-hidden="true" className="bg-ink-subtle size-2 rounded-full" />
        Nobody is here right now
      </span>
    );
  }

  return (
    <span className="text-ink-muted flex items-center gap-2 text-sm">
      <Spinner className="size-3" />
      {coverage === "busy"
        ? "Waiting for someone to be free"
        : "Finding someone to talk with you"}
    </span>
  );
}

/**
 * Shown once, quietly, when a seeker is waiting and the rota is empty.
 *
 * Two things a person in this position needs and cannot work out for
 * themselves: that writing it down was not wasted, and that there is
 * somewhere else to go if tonight cannot wait. Neither is an apology, and
 * neither suggests they should leave.
 *
 * The helpline is suppressed when the crisis card is already showing, so
 * nobody gets the same directory twice on one screen.
 */
function NobodyOnNote({ showHelpline }: { readonly showHelpline: boolean }) {
  return (
    <p className="text-ink-subtle mb-3 text-sm leading-relaxed">
      What you write is saved. Come back on this device and you will find any
      reply.
      {showHelpline ? (
        <>
          {" "}
          If you need someone tonight,{" "}
          <a
            href={INTERNATIONAL_DIRECTORY.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink-muted underline underline-offset-2"
          >
            {INTERNATIONAL_DIRECTORY.name}
          </a>{" "}
          lists free, confidential support in over 130 countries.
        </>
      ) : null}
    </p>
  );
}
