import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/Brand";
import { VolunteerQueue } from "@/components/VolunteerQueue";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function VolunteerConsolePage() {
  const session = await staffSession();
  // An admin session is not a volunteer session; see requireVolunteer.
  if (session?.role !== "volunteer") redirect("/volunteer/login");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Wordmark className="mb-8 h-6" />
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-ink font-serif text-2xl">Welcome, {session.displayName}</h1>
        <Link
          href="/volunteer/practice"
          className="text-ink-muted text-sm underline underline-offset-2"
        >
          Practice
        </Link>
      </header>
      <div className="mt-8">
        <VolunteerQueue />
      </div>
    </main>
  );
}
