"use client";

import { useEffect, useRef } from "react";
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
}: {
  readonly conversationId: string;
  readonly viewerRole: "seeker" | "volunteer";
}) {
  const { messages, matched, status, loading, crisis, send } =
    useConversation(conversationId);
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
        <span className="text-ink font-serif text-lg">Nexus</span>
        {viewerRole === "seeker" ? (
          <WaitingIndicator matched={matched} ended={ended} />
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="text-ink-subtle" />
          </div>
        ) : (
          <MessageList messages={messages} viewerRole={viewerRole} />
        )}
      </div>

      <div className="border-line border-t pt-4">
        {crisis.active && crisis.resources ? (
          <CrisisCard resources={crisis.resources} conversationId={conversationId} />
        ) : null}
        {ended ? (
          <p className="text-ink-muted py-2 text-center text-sm">
            This conversation has ended.
          </p>
        ) : (
          <Composer onSend={send} disabled={ended} />
        )}
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
 */
function WaitingIndicator({
  matched,
  ended,
}: {
  readonly matched: boolean;
  readonly ended: boolean;
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
  return (
    <span className="text-ink-muted flex items-center gap-2 text-sm">
      <Spinner className="size-3" />
      Finding someone to talk with you
    </span>
  );
}
