import type { Metadata } from "next";
import Link from "next/link";
import { VolunteerApplyForm } from "@/components/VolunteerApplyForm";

export const metadata: Metadata = {
  title: "Volunteer with Nexus",
  robots: { index: false, follow: false },
};

export default function VolunteerApplyPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-6 py-16">
      <h1 className="text-ink font-serif text-2xl">Volunteer with Nexus</h1>
      <p className="text-ink-muted mt-3">
        People arrive here from anywhere in the world, often at a difficult moment, and
        write in whatever language they think in. Everything is translated both ways, so
        you can help someone whose language you do not speak.
      </p>
      <p className="text-ink-muted mt-3">
        An administrator reads every application before an account can be used. You will
        not be matched with anyone until then.
      </p>

      <div className="mt-8">
        <VolunteerApplyForm />
      </div>

      <p className="text-ink-subtle mt-6 text-sm">
        Already approved?{" "}
        <Link href="/volunteer/login" className="underline underline-offset-2">
          Sign in
        </Link>
        .
      </p>
    </main>
  );
}
