"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@nexus/ui";

export function Composer({
  onSend,
  placeholder = "Write here…",
  disabled = false,
}: {
  readonly onSend: (text: string) => Promise<void>;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = text.trim();
    if (!message || busy || disabled) return;

    setBusy(true);
    // Clear immediately. Watching your own words sit in the box while a
    // translation round-trips feels like the app has stalled.
    setText("");
    try {
      await onSend(message);
    } catch {
      setText(message);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-3">
      <label htmlFor="composer" className="sr-only">
        Write a message
      </label>
      <textarea
        id="composer"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        maxLength={4000}
        disabled={disabled}
        placeholder={placeholder}
        className="border-line bg-surface text-ink placeholder:text-ink-subtle focus:border-accent max-h-40 min-h-12 flex-1 resize-none rounded-lg border px-4 py-3 text-base outline-none transition-colors disabled:opacity-60"
      />
      <Button type="submit" busy={busy} disabled={disabled || text.trim().length === 0}>
        Send
      </Button>
    </form>
  );
}
