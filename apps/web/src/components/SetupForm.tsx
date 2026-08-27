"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card } from "@nexus/ui";

const FIELD =
  "h-11 rounded-md border border-line bg-surface px-3 text-ink outline-none " +
  "transition-colors focus:border-accent";

export function SetupForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [languages, setLanguages] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/setup/volunteer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          displayName,
          email,
          password,
          languages: languages
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean),
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
        <p className="text-ink font-medium">Your account is ready.</p>
        <p className="text-ink-muted mt-2 text-sm">
          Two things left. Sign in below, and then remove{" "}
          <code className="bg-surface-sunken rounded px-1">NEXUS_SETUP_TOKEN</code> from
          your Vercel environment variables — this page has already closed itself, but
          there is no reason to leave the token lying around.
        </p>
        <Button className="mt-5 w-full" onClick={() => router.push("/volunteer/login")}>
          Go to sign in
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          id="token"
          label="Setup token"
          hint="The value you set for NEXUS_SETUP_TOKEN in Vercel."
          value={token}
          onChange={setToken}
          type="password"
          autoComplete="off"
        />
        <Field
          id="displayName"
          label="Your name"
          hint="What a seeker sees when you are talking with them."
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
        <Field
          id="languages"
          label="Languages you can talk in"
          hint="Comma separated, e.g. en, es. Seekers who speak other languages are still matched to you — everything is translated."
          value={languages}
          onChange={setLanguages}
        />

        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}

        <Button type="submit" busy={busy} className="mt-2">
          Create my account
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
        className={FIELD}
      />
    </div>
  );
}
