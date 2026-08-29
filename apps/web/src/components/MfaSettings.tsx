"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Spinner, field } from "@nexus/ui";

interface Status {
  readonly enrolled: boolean;
  readonly enabled: boolean;
  readonly recoveryCodesRemaining: number;
}

interface Enrolment {
  readonly secret: string;
  readonly uri: string;
  readonly qrSvg: string;
}

export function MfaSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/mfa", { cache: "no-store" });
    if (response.ok) setStatus((await response.json()) as Status);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const parsed = (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      if (!response.ok) {
        const message = (parsed?.error as { message?: string } | undefined)?.message;
        setError(message ?? "Something went wrong.");
        return null;
      }
      return parsed;
    } catch {
      setError("Could not reach the server.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="text-ink-subtle" />
      </div>
    );
  }

  // Shown once, immediately after enabling. Never retrievable again.
  if (recoveryCodes) {
    return (
      <Card>
        <p className="text-ink font-medium">Save these recovery codes now.</p>
        <p className="text-ink-muted mt-2 text-sm">
          Each one signs you in once if you lose your phone. They are not stored in a form
          we can read, so this is the only time they can be shown. Print them, or put them
          somewhere you would keep a spare key.
        </p>
        <ul className="bg-surface-sunken mt-4 grid grid-cols-2 gap-2 rounded-md p-4 font-mono text-sm">
          {recoveryCodes.map((c) => (
            <li key={c} className="text-ink">
              {c}
            </li>
          ))}
        </ul>
        <Button
          className="mt-5 w-full"
          onClick={() => {
            setRecoveryCodes(null);
            void load();
          }}
        >
          I have saved them
        </Button>
      </Card>
    );
  }

  if (status.enabled) {
    return (
      <Card>
        <p className="text-ink font-medium">Two-factor authentication is on.</p>
        <p className="text-ink-muted mt-2 text-sm">
          {status.recoveryCodesRemaining} recovery{" "}
          {status.recoveryCodesRemaining === 1 ? "code" : "codes"} left.
          {status.recoveryCodesRemaining <= 2 ? (
            <span className="text-caution">
              {" "}
              Turn it off and on again to get a fresh set.
            </span>
          ) : null}
        </p>

        <label htmlFor="disable-code" className="text-ink mt-6 block text-sm font-medium">
          Turn it off
        </label>
        <p className="text-ink-subtle text-xs">
          Enter a current code or a recovery code. Being signed in is not enough — a
          borrowed laptop is exactly what this protects against.
        </p>
        <div className="mt-2 flex gap-3">
          <input
            id="disable-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className={field("md", "flex-1")}
          />
          <Button
            variant="danger"
            busy={busy}
            onClick={async () => {
              const result = await post("/api/admin/mfa", { code }, "DELETE");
              if (result) {
                setCode("");
                await load();
              }
            }}
          >
            Turn off
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-danger mt-2 text-sm">
            {error}
          </p>
        ) : null}
      </Card>
    );
  }

  if (enrolment) {
    return (
      <Card>
        <p className="text-ink font-medium">Scan this with your authenticator app.</p>
        <p className="text-ink-muted mt-2 text-sm">
          Google Authenticator, 1Password, Bitwarden, Authy — any of them.
        </p>

        <div
          className="bg-surface mx-auto mt-4 w-44 rounded-md p-2 [&_svg]:h-full [&_svg]:w-full"
          // Rendered server-side by the qrcode library; no user input reaches it.
          dangerouslySetInnerHTML={{ __html: enrolment.qrSvg }}
        />

        <p className="text-ink-subtle mt-4 text-xs">
          Cannot scan? Enter this key by hand:
        </p>
        <p className="bg-surface-sunken text-ink mt-1 break-all rounded p-2 font-mono text-sm">
          {enrolment.secret}
        </p>

        <label htmlFor="enable-code" className="text-ink mt-6 block text-sm font-medium">
          Then type the six-digit code it shows
        </label>
        <div className="mt-2 flex gap-3">
          <input
            id="enable-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className={field("md", "flex-1 font-mono")}
          />
          <Button
            busy={busy}
            onClick={async () => {
              const result = await post("/api/admin/mfa/enable", { code });
              if (result) {
                setRecoveryCodes(result.recoveryCodes as string[]);
                setEnrolment(null);
                setCode("");
              }
            }}
          >
            Turn on
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-danger mt-2 text-sm">
            {error}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-ink font-medium">Two-factor authentication is off.</p>
      <p className="text-ink-muted mt-2 text-sm">
        You will be given recovery codes, so losing your phone does not mean losing the
        account.
      </p>
      <Button
        className="mt-5"
        busy={busy}
        onClick={async () => {
          const result = await post("/api/admin/mfa/enrol");
          if (result) setEnrolment(result as unknown as Enrolment);
        }}
      >
        Set it up
      </Button>
      {error ? (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
