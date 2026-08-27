"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@nexus/ui";

/**
 * The entry point. A text box and nothing else.
 *
 * The first message is sent with the request that creates the conversation,
 * so the seeker never sees an empty room — they write, and they are already
 * talking. Waiting for a volunteer happens behind their message, not in front
 * of it.
 */
export function SeekerEntry() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(event?: FormEvent) {
    event?.preventDefault();
    const message = text.trim();
    if (!message || busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/seeker/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstMessage: message }),
      });

      if (!response.ok) throw new Error("start failed");
      const { conversationId } = (await response.json()) as { conversationId: string };

      // Hand the first message to the chat view so it can send it once the
      // conversation exists, rather than making the seeker retype it.
      sessionStorage.setItem(`nexus:pending:${conversationId}`, message);
      router.push(`/chat/${conversationId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter makes a new line. The convention every chat
    // app already taught the world, so nobody has to be told.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void start();
    }
  }

  return (
    <form onSubmit={start} className="w-full">
      <label htmlFor="seeker-message" className="sr-only">
        Write your message in any language
      </label>
      <textarea
        id="seeker-message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={4}
        autoFocus
        maxLength={4000}
        placeholder="Write here…"
        className="border-line bg-surface text-ink shadow-soft placeholder:text-ink-subtle focus:border-accent w-full resize-none rounded-lg border p-5 text-lg outline-none transition-colors duration-200"
      />

      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        busy={busy}
        disabled={text.trim().length === 0}
        className="mt-4 w-full"
      >
        {busy ? "Connecting…" : "Start talking"}
      </Button>
    </form>
  );
}
