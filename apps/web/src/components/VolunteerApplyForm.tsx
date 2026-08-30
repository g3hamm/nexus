"use client";

import { useState, type FormEvent } from "react";
import type { LanguageCode } from "@nexus/core";
import { Button, Card } from "@nexus/ui";
import { LanguageMultiSelect } from "./LanguageMultiSelect";

const FIELD =
  "rounded-md border border-line bg-surface px-3 text-ink outline-none " +
  "transition-colors focus:border-accent";

export function VolunteerApplyForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [languages, setLanguages] = useState<LanguageCode[]>(["en"]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/volunteer/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          password,
          note,
          languages,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }

      setDone(true);
    } catch {
      setError("Could not reach the server. Please try again.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card>
        <p className="text-ink font-medium">Thank you — your application is in.</p>
        <p className="text-ink-muted mt-2 text-sm">
          An administrator will read it and decide. Once your account is approved you can
          sign in at{" "}
          <code className="bg-surface-sunken rounded px-1">/volunteer/login</code> with
          the email and password you just chose.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          id="displayName"
          label="Your name"
          hint="What a seeker sees while you are talking with them."
          value={displayName}
          onChange={setDisplayName}
          autoComplete="name"
        />
        <Field
          id="email"
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
        />
        <Field
          id="password"
          label="Password"
          hint="At least 12 characters. A short phrase beats a mangled word."
          value={password}
          onChange={setPassword}
          type="password"
          autoComplete="new-password"
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="languages" className="text-ink text-sm font-medium">
            Languages you can hold a conversation in
          </label>
          <p className="text-ink-subtle text-xs">
            This does not limit who you are matched with — everything is translated.
          </p>
          <LanguageMultiSelect id="languages" value={languages} onChange={setLanguages} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="note" className="text-ink text-sm font-medium">
            A little about you
          </label>
          <p className="text-ink-subtle text-xs">
            Who you are, your church or ministry if you have one, and any experience of
            this kind of conversation. A few sentences is plenty — this is what an
            administrator reads before approving you.
          </p>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            minLength={20}
            maxLength={1500}
            required
            className={`${FIELD} resize-none py-2.5 text-sm`}
          />
        </div>

        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}

        <Button type="submit" busy={busy} className="mt-2">
          Send my application
        </Button>
      </form>
    </Card>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: string;
  readonly autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-sm font-medium">
        {label}
      </label>
      {hint ? <p className="text-ink-subtle text-xs">{hint}</p> : null}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        {...(autoComplete ? { autoComplete } : {})}
        className={`${FIELD} h-11`}
      />
    </div>
  );
}
