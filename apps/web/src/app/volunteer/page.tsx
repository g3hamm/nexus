import { redirect } from "next/navigation";
import { VolunteerQueue } from "@/components/VolunteerQueue";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function VolunteerConsolePage() {
  const session = await staffSession();
  if (!session) redirect("/volunteer/login");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="flex items-baseline justify-between">
        <h1 className="text-ink font-serif text-2xl">Welcome, {session.displayName}</h1>
      </header>
      <div className="mt-8">
        <VolunteerQueue />
      </div>
    </main>
  );
}
