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
 * The name is asked for and required, which is a deliberate reversal.
 *
 * The argument against was friction in front of someone in distress. The
 * argument that won is that this is not a crisis line — it is a place to come
 * and ask about Christ, and somebody with the composure to write a paragraph
 * about what they believe has the composure to type one word first. What the
 * ministry gets back is worth the word: a volunteer addresses a person rather
 * than a language, two open conversations can be told apart, and a name nobody
 * would give in earnest says something useful before anyone has spent twenty
 * minutes finding out.
 *
 * "Any name you like" rather than "your name", and that wording is not
 * softness. For a seeker somewhere this conversation is dangerous, being
 * nudged toward their real name would be the worst thing this page could do.
 * Nothing here verifies it, and nothing should.
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
    const called = name.trim();
    if (!message || !called || busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/seeker/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstMessage: message, name: called }),
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
      <div className="mb-4">
        <label htmlFor="seeker-name" className="text-ink-muted mb-1.5 block text-sm">
          What can we call you?
        </label>
        <input
          id="seeker-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={40}
          autoComplete="off"
          autoFocus
          dir="auto"
          placeholder="Any name you like"
          className={field("md")}
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
        maxLength={4000}
        // The question the heading used to ask, moved down to the point of
        // action. "Write here" told a visitor where to click and nothing
        // about what for; the actual invitation belongs on the field they
        // are about to use it in.
        placeholder="What's on your mind?"
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
        disabled={text.trim().length === 0 || name.trim().length === 0}
        className="mt-4 w-full"
      >
        {busy ? "Connecting…" : "Start talking"}
      </Button>
    </form>
  );
}
