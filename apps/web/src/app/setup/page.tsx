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
  const c = enabled ? container() : null;
  const [volunteers, admins] = c
    ? await Promise.all([c.volunteers.count(), c.admins.count()])
    : [0, 0];

  // A volunteer with no administrator is an install that predates the admin
  // area. It still needs a way in, so setup stays open to create just that.
  const adminOnly = volunteers > 0 && admins === 0;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-ink font-serif text-2xl">Set up Nexus</h1>

      {!enabled ? (
        <Closed
          heading="Setup is switched off."
          body="Add a NEXUS_SETUP_TOKEN environment variable in Vercel and redeploy to turn it on."
        />
      ) : admins > 0 ? (
        <Closed
          heading="Setup is already done."
          body="An administrator account exists, so this page has closed itself. Sign in at /volunteer/login or /admin/login. Remove NEXUS_SETUP_TOKEN from your environment variables — it does nothing now."
        />
      ) : (
        <>
          <p className="text-ink-muted mt-2">
            {adminOnly
              ? "This install has a volunteer but no administrator, so nobody can open the moderation queue. This creates the administrator account."
              : "This creates your volunteer and administrator accounts. It works once, then closes itself."}
          </p>
          <div className="mt-8">
            <SetupForm adminOnly={adminOnly} />
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
