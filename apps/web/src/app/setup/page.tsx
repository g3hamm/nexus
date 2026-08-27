import type { Metadata } from "next";
import { SetupForm } from "@/components/SetupForm";
import { container } from "@/server/container";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up Nexus",
  robots: { index: false, follow: false },
};

/**
 * First-run setup, so getting a working account never requires a terminal.
 *
 * Deliberately says out loud when it is closed and why, rather than 404ing —
 * someone following setup instructions who lands on a blank page has no idea
 * whether they succeeded or broke something.
 */
export default async function SetupPage() {
  const enabled = Boolean(env().NEXUS_SETUP_TOKEN);
  const existing = enabled ? await container().volunteers.count() : 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-ink font-serif text-2xl">Set up Nexus</h1>

      {!enabled ? (
        <Closed
          heading="Setup is switched off."
          body="Add a NEXUS_SETUP_TOKEN environment variable in Vercel and redeploy to turn it on."
        />
      ) : existing > 0 ? (
        <Closed
          heading="Setup is already done."
          body="A volunteer account exists, so this page has closed itself. You can sign in at /volunteer/login. Remove NEXUS_SETUP_TOKEN from your environment variables — it does nothing now."
        />
      ) : (
        <>
          <p className="text-ink-muted mt-2">
            This creates your first volunteer account. It works once, then closes itself.
          </p>
          <div className="mt-8">
            <SetupForm />
          </div>
        </>
      )}
    </main>
  );
}

function Closed({ heading, body }: { readonly heading: string; readonly body: string }) {
  return (
    <div className="border-line bg-surface-sunken mt-6 rounded-lg border p-5">
      <p className="text-ink font-medium">{heading}</p>
      <p className="text-ink-muted mt-2 text-sm">{body}</p>
    </div>
  );
}
