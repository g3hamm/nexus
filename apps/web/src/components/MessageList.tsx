"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@nexus/ui";
import type { TranscriptEntry } from "./useConversation";

function direction(language: string): "ltr" | "rtl" {
  const rtl = new Set([
    "ar",
    "arc",
    "az",
    "dv",
    "fa",
    "he",
    "ku",
    "ps",
    "sd",
    "ug",
    "ur",
    "yi",
  ]);
  return rtl.has(language.split("-")[0]?.toLowerCase() ?? "") ? "rtl" : "ltr";
}

/**
 * The transcript.
 *
 * Translated messages carry a quiet affordance to see the original. It is
 * deliberately understated — a badge on every line would make the machinery
 * the subject of the conversation, which is exactly what a seeker should not
 * be thinking about.
 */
export function MessageList({
  messages,
  viewerRole,
}: {
  readonly messages: readonly TranscriptEntry[];
  readonly viewerRole: "seeker" | "volunteer";
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <Bubble key={message.id} message={message} viewerRole={viewerRole} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function Bubble({
  message,
  viewerRole,
}: {
  readonly message: TranscriptEntry;
  readonly viewerRole: "seeker" | "volunteer";
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const mine = message.authorRole === viewerRole;
  const dir = direction(showOriginal ? message.originalLanguage : message.language);

  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[85%] flex-col gap-1", mine && "items-end")}>
        <div
          dir={dir}
          className={cn(
            "whitespace-pre-wrap break-words rounded-xl px-4 py-3 text-base leading-relaxed",
            mine
              ? "bg-volunteer-bubble text-volunteer-ink"
              : "bg-seeker-bubble text-seeker-ink",
          )}
        >
          {showOriginal ? message.originalText : message.text}
        </div>

        {message.translationUnavailable ? (
          <span className="text-caution px-1 text-xs">
            Shown in the original — translation is unavailable right now
          </span>
        ) : message.wasTranslated ? (
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="text-ink-subtle hover:text-ink-muted px-1 text-xs underline-offset-2 transition-colors hover:underline"
          >
            {showOriginal ? "Show translation" : "Show original"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
