"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card } from "@nexus/ui";

export function VolunteerLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/volunteer/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        // Show the server's message for suspended and pending-approval cases,
        // which a volunteer needs to understand, but never distinguish
        // "no such account" from "wrong password".
        setError(body?.error?.message ?? "Email or password is incorrect");
        setBusy(false);
        return;
      }

      router.push("/volunteer");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setBusy(false);
    }
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
            className="border-line bg-surface text-ink focus:border-accent h-11 rounded-md border px-3 outline-none transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-ink text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="border-line bg-surface text-ink focus:border-accent h-11 rounded-md border px-3 outline-none transition-colors"
          />
        </div>

        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}

        <Button type="submit" busy={busy} className="mt-2">
          Sign in
        </Button>
      </form>
    </Card>
  );
}
