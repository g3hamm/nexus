"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, field } from "@nexus/ui";

/**
 * The entry point. A text box, and one optional line above it.
 *
 * The first message is sent with the request that creates the conversation,
 * so the seeker never sees an empty room — they write, and they are already
 * talking. Waiting for a volunteer happens behind their message, not in front
 * of it.
 *
 * The name field is the only thing here that is not the message, and it earns
 * its place three times over: a volunteer can address a person instead of a
 * language, someone holding two conversations can tell them apart, and a name
 * nobody would give in earnest says something useful before anyone has spent
 * twenty minutes finding out.
 *
 * It gates nothing. Autofocus stays on the message, Enter still sends from the
 * message, and the button is enabled on the message alone — so someone who has
 * worked up to typing one sentence is never stopped by a form field. The hint
 * says "any name" rather than "your name" deliberately: for a seeker somewhere
 * this conversation is dangerous, being nudged toward their real one would be
 * the worst thing this page could do.
 */
export function SeekerEntry() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
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
        body: JSON.stringify({
          firstMessage: message,
          ...(name.trim() ? { name: name.trim() } : {}),
        }),
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
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <label htmlFor="seeker-name" className="text-ink-muted text-sm">
          What can we call you?
        </label>
        <input
          id="seeker-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoComplete="off"
          dir="auto"
          placeholder="Optional — any name you like"
          className={field("sm", "min-w-0 flex-1")}
        />
      </div>

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
        className={field("lg", "shadow-soft resize-none p-5 text-lg")}
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
