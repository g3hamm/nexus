"use client";

import {
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Button, field } from "@nexus/ui";

/** Matches the server's own `sendSchema` cap — see `messages/route.ts`. */
const MAX_LENGTH = 4000;

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  /**
   * A verse dragged from the volunteer sidebar, inserted at the cursor
   * rather than appended — there may already be something half-typed on
   * either side of where it belongs. The native `maxLength` attribute only
   * constrains typing and pasting, not a state update from a drop, so this
   * clamps explicitly to the same limit the server enforces.
   */
  function onDrop(event: DragEvent<HTMLTextAreaElement>) {
    const dropped = event.dataTransfer.getData("text/plain");
    if (!dropped) return;
    // Stops the textarea's own native drop handling, which would otherwise
    // insert the same text a second time right behind this one.
    event.preventDefault();

    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + dropped + text.slice(end)).slice(0, MAX_LENGTH);
    setText(next);
    if (next.trim().length > 0) onTyping?.();

    const caret = Math.min(start + dropped.length, MAX_LENGTH);
    // After the paint that actually shows the new value — setting it any
    // earlier moves the caret against the textarea's still-stale content.
    requestAnimationFrame(() => el?.setSelectionRange(caret, caret));
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-3">
      <label htmlFor="composer" className="sr-only">
        Write a message
      </label>
      <textarea
        ref={textareaRef}
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
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        rows={1}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        placeholder={placeholder}
        className={field("lg", "max-h-40 min-h-12 flex-1 resize-none")}
      />
      {/*
        `lg`, to match the field beside it.

        The default `md` button is 44px against a 52px field, and bottom-
        aligning them left the send button visibly short and squarer than the
        box it belongs to. Button and field sizes are built to pair — an `lg`
        button is the same height and radius as an `lg` field — so the fix is
        to say so rather than to nudge a margin.

        The label stays at the field's own size. `lg` bumps type to 19px,
        which is right for the front door's full-width "Start talking" and too
        loud for a Send button sitting next to what someone is writing.
      */}
      <Button
        type="submit"
        size="lg"
        className="text-base"
        busy={busy}
        disabled={disabled || text.trim().length === 0}
      >
        Send
      </Button>
    </form>
  );
}
