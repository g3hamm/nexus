"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card } from "@nexus/ui";

const FIELD =
  "h-11 rounded-md border border-line bg-surface px-3 text-ink outline-none " +
  "transition-colors focus:border-accent";

export function VolunteerResetForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/volunteer/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card>
        <p className="text-ink font-medium">Your password is set.</p>
        <Button className="mt-5 w-full" onClick={() => router.push("/volunteer/login")}>
          Sign in
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-ink text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="text-ink text-sm font-medium">
            Reset code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            placeholder="abcd-efgh-ijkl"
            className={`${FIELD} font-mono`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-ink text-sm font-medium">
            New password
          </label>
          <p className="text-ink-subtle text-xs">
            At least 12 characters. A short phrase beats a mangled word.
          </p>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className={FIELD}
          />
        </div>

        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}

        <Button type="submit" busy={busy} className="mt-2">
          Set my password
        </Button>
      </form>
    </Card>
  );
}
