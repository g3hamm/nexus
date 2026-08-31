import Link from "next/link";
import { redirect } from "next/navigation";
import { VolunteerLoginForm } from "@/components/VolunteerLoginForm";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function VolunteerLoginPage() {
  // Specifically a volunteer, matching the guard on the pages this sends
  // them to. Bouncing on any staff session at all was a redirect loop: an
  // administrator has a session, so this sent them to /volunteer, which
  // requires the volunteer role and sent them straight back here. One
  // browser holds one staff role at a time — see `requireVolunteer` — so an
  // admin arriving here wants the sign-in form, not a round trip.
  if ((await staffSession())?.role === "volunteer") redirect("/volunteer");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-ink font-serif text-2xl">Volunteer sign in</h1>
      <p className="text-ink-muted mt-2">Sign in to see who is waiting to talk.</p>
      <div className="mt-8">
        <VolunteerLoginForm />
      </div>

      <p className="text-ink-subtle mt-6 text-sm">
        Forgotten your password? Ask an administrator for a reset code, then use it at{" "}
        <Link href="/volunteer/reset" className="underline underline-offset-2">
          /volunteer/reset
        </Link>
        .
      </p>

      <p className="text-ink-subtle mt-2 text-sm">
        Not a volunteer yet?{" "}
        <Link href="/volunteer/apply" className="underline underline-offset-2">
          Apply to help
        </Link>
        .
      </p>
    </main>
  );
}
