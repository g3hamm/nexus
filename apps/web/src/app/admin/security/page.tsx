import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { MfaSettings } from "@/components/MfaSettings";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const claims = await staffSession();
  if (claims?.role !== "admin") redirect("/admin/login");

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <AdminNav current="security" />
      <h1 className="text-ink font-serif text-xl">Your sign-in</h1>
      <p className="text-ink-muted mt-2">
        An administrator account opens every transcript on this platform. A second factor
        is the difference between a stolen password costing you an account and costing
        every seeker who has talked to you.
      </p>
      <div className="mt-8">
        <MfaSettings />
      </div>
    </main>
  );
}
