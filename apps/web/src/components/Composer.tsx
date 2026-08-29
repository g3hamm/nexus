"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, field } from "@nexus/ui";

export function Composer({
  onSend,
  onTyping,
  placeholder = "Write here…",
  disabled = false,
}: {
  readonly onSend: (text: string) => Promise<void>;
  /** Fire-and-forget. Throttled by the caller; safe to call on every keystroke. */
  readonly onTyping?: (() => void) | undefined;
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
        onChange={(e) => {
          setText(e.target.value);
          // Only while there is something to say. Announcing on the keystroke
          // that empties the box would tell the other person you are writing
          // at the moment you gave up.
          if (e.target.value.trim().length > 0) onTyping?.();
        }}
        onKeyDown={onKeyDown}
        rows={1}
        maxLength={4000}
        disabled={disabled}
        placeholder={placeholder}
        className={field("lg", "max-h-40 min-h-12 flex-1 resize-none")}
      />
      <Button type="submit" busy={busy} disabled={disabled || text.trim().length === 0}>
        Send
      </Button>
    </form>
  );
}
