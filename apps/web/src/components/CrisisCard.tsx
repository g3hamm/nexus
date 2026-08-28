"use client";

import { useEffect, useState } from "react";
import type { CrisisResources, Helpline } from "@nexus/core";

/**
 * Emergency numbers, shown to someone who may be about to hurt themselves.
 *
 * Everything about how this looks is a decision.
 *
 * It is not red, it does not use the danger colour, and it carries no warning
 * icon. Alarm is for the reader's benefit only when the reader has time to
 * react to it; here it would read as *you have been detected*, which is the
 * opposite of what someone in this state can absorb. It looks like a quiet
 * note, because that is what it is.
 *
 * It does not interrupt. No modal, no overlay, nothing that has to be
 * dismissed before the person can carry on typing — the conversation is the
 * thing that is helping, and taking it away to show a phone number would be
 * a strange kind of care. It sits above the composer and it can be closed.
 *
 * It says nothing about moderation, flags, or review. The seeker is not told
 * that a model formed an opinion about them.
 */
export function CrisisCard({
  resources,
  conversationId,
}: {
  readonly resources: CrisisResources;
  readonly conversationId: string;
}) {
  const { strings } = resources;
  const storageKey = `nexus:crisis-dismissed:${conversationId}`;
  const [dismissed, setDismissed] = useState(true);

  // Starts hidden and appears after the check, rather than appearing and then
  // vanishing. Reading the storage during render would break hydration, and a
  // card that flashes on and off is worse than one that arrives a beat late.
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(storageKey) === "1");
    } catch {
      // Private browsing, blocked storage. Showing it is the safe failure.
      setDismissed(false);
    }
  }, [storageKey]);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // It stays closed for this view either way.
    }
  }

  return (
    <aside
      dir="auto"
      aria-label={strings.heading}
      className="border-line-strong bg-surface-raised mb-4 rounded-[--radius-md] border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-ink font-serif text-base">{strings.heading}</h2>
        <button
          type="button"
          onClick={dismiss}
          className="text-ink-subtle hover:text-ink-muted -my-1 shrink-0 rounded px-2 py-1 text-sm"
        >
          {strings.dismiss}
        </button>
      </div>

      <p className="text-ink-muted mt-2 text-sm leading-relaxed">{strings.body}</p>

      <ul className="mt-3 space-y-2">
        {resources.emergency ? (
          <Entry
            label={strings.emergencyLabel}
            helpline={{ name: strings.emergencyLabel, contact: resources.emergency }}
            hideName
          />
        ) : null}

        {resources.helplines.map((helpline) => (
          <Entry key={`${helpline.name}:${helpline.contact}`} helpline={helpline} />
        ))}

        <Entry helpline={resources.directory} label={strings.directoryLabel} />
      </ul>
    </aside>
  );
}

function Entry({
  helpline,
  label,
  hideName = false,
}: {
  readonly helpline: Helpline;
  readonly label?: string;
  readonly hideName?: boolean;
}) {
  return (
    <li className="text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {hideName ? null : (
          <span className="text-ink" dir="auto">
            {helpline.name}
          </span>
        )}
        <Contact helpline={helpline} />
      </div>
      {label && hideName ? (
        <span className="text-ink-subtle text-xs">{label}</span>
      ) : null}
      {helpline.note ? (
        <span className="text-ink-subtle block text-xs" dir="auto">
          {helpline.note}
        </span>
      ) : null}
    </li>
  );
}

/**
 * The number itself, dialable where that makes sense.
 *
 * A `tel:` link only where the contact really is a number to dial. "Text HOME
 * to 741741" and "findahelpline.com" are instructions, not phone numbers, and
 * wrapping them in a dialer link produces a call to nowhere at the exact
 * moment someone cannot afford a confusing failure.
 */
function Contact({ helpline }: { readonly helpline: Helpline }) {
  const classes = "text-ink font-medium tabular-nums underline-offset-2 hover:underline";

  if (helpline.url) {
    return (
      <a href={helpline.url} target="_blank" rel="noreferrer noopener" className={classes}>
        {helpline.contact}
      </a>
    );
  }

  if (/^[+\d][\d\s\-().]*$/.test(helpline.contact)) {
    return (
      <a href={`tel:${helpline.contact.replace(/[\s\-().]/g, "")}`} className={classes}>
        {helpline.contact}
      </a>
    );
  }

  return <span className={classes}>{helpline.contact}</span>;
}
