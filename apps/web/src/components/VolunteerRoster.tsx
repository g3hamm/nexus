"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Spinner, StatusDot } from "@nexus/ui";

interface VolunteerRow {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly languageNames: string[];
  readonly status: string;
  readonly approved: boolean;
  readonly suspended: boolean;
  readonly applicationNote: string | null;
  readonly createdAt: string;
}

export function VolunteerRoster() {
  const [rows, setRows] = useState<VolunteerRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shown once, right after issuing. There is no way to retrieve it later.
  const [issued, setIssued] = useState<{ email: string; code: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/volunteers", { cache: "no-store" });
      if (!response.ok) throw new Error("failed");
      const body = (await response.json()) as { volunteers: VolunteerRow[] };
      setRows(body.volunteers);
    } catch {
      setError("Could not load volunteers.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(id: string, patch: Record<string, boolean>) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/volunteers/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("failed");
      await load();
    } catch {
      setError("Could not save that change.");
    } finally {
      setBusy(null);
    }
  }

  async function issueReset(id: string) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/volunteers/${id}/reset`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("failed");
      const body = (await response.json()) as { email: string; code: string };
      setIssued(body);
    } catch {
      setError("Could not issue a reset code.");
    } finally {
      setBusy(null);
    }
  }

  if (error && !rows) return <p className="text-danger text-sm">{error}</p>;
  if (!rows) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="text-ink-subtle" />
      </div>
    );
  }

  // Unapproved first — someone is waiting on a decision to be able to help.
  const ordered = [...rows].sort((a, b) => Number(a.approved) - Number(b.approved));

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-danger text-sm">{error}</p> : null}

      {issued ? (
        <Card className="border-accent/40">
          <p className="text-ink font-medium">Reset code for {issued.email}</p>
          <p className="bg-surface-sunken text-ink mt-3 rounded-md p-3 text-center font-mono text-lg">
            {issued.code}
          </p>
          <p className="text-ink-muted mt-3 text-sm">
            Give this to them however you already talk — Nexus sends no email. It works
            once, expires in 24 hours, and cannot be shown again. They enter it at{" "}
            <code className="bg-surface-sunken rounded px-1">/volunteer/reset</code>.
          </p>
          <Button variant="quiet" className="mt-4 w-full" onClick={() => setIssued(null)}>
            Done
          </Button>
        </Card>
      ) : null}

      {ordered.length === 0 ? (
        <Card>
          <p className="text-ink-muted text-center">No volunteers yet.</p>
        </Card>
      ) : (
        ordered.map((volunteer) => (
          <Card key={volunteer.id} padded={false} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-ink">{volunteer.displayName}</p>
                <p className="text-ink-subtle truncate text-sm">{volunteer.email}</p>
                <p className="text-ink-muted mt-1 text-sm">
                  {volunteer.languageNames.join(", ")}
                </p>
                {/* The applicant's own words. This is what approval is a
                    decision about, so it belongs on the card, not behind a
                    click. */}
                {!volunteer.approved && volunteer.applicationNote ? (
                  <p className="bg-surface-sunken text-ink-muted mt-3 rounded-md p-3 text-sm">
                    {volunteer.applicationNote}
                  </p>
                ) : null}

                <div className="mt-2">
                  {volunteer.suspended ? (
                    <StatusDot status="offline" label="Suspended" />
                  ) : !volunteer.approved ? (
                    <StatusDot status="busy" label="Awaiting approval" />
                  ) : (
                    <StatusDot
                      status={volunteer.status === "available" ? "available" : "away"}
                      label={volunteer.status === "available" ? "Available" : "Approved"}
                    />
                  )}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                {!volunteer.approved ? (
                  <Button
                    size="sm"
                    busy={busy === volunteer.id}
                    onClick={() => void update(volunteer.id, { approved: true })}
                  >
                    Approve
                  </Button>
                ) : null}
                {volunteer.approved ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    busy={busy === volunteer.id}
                    onClick={() => void issueReset(volunteer.id)}
                  >
                    Reset password
                  </Button>
                ) : null}
                {volunteer.suspended ? (
                  <Button
                    variant="quiet"
                    size="sm"
                    busy={busy === volunteer.id}
                    onClick={() => void update(volunteer.id, { suspended: false })}
                  >
                    Reinstate
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    busy={busy === volunteer.id}
                    onClick={() => void update(volunteer.id, { suspended: true })}
                  >
                    Suspend
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))
      )}

      <p className="text-ink-subtle mt-2 text-xs">
        A volunteer cannot be matched with anyone until approved. Vetting who speaks to
        seekers is the safety model, not a formality.
      </p>
    </div>
  );
}
