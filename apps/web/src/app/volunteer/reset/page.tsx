import type { Metadata } from "next";
import Link from "next/link";
import { VolunteerResetForm } from "@/components/VolunteerResetForm";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

export default function VolunteerResetPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-ink font-serif text-2xl">Set a new password</h1>
      <p className="text-ink-muted mt-2">
        Use the code an administrator gave you. If you do not have one, ask them to issue
        it.
      </p>
      <div className="mt-8">
        <VolunteerResetForm />
      </div>
      <p className="text-ink-subtle mt-6 text-sm">
        <Link href="/volunteer/login" className="underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
