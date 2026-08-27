import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { VolunteerRoster } from "@/components/VolunteerRoster";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminVolunteersPage() {
  const claims = await staffSession();
  if (claims?.role !== "admin") redirect("/admin/login");

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <AdminNav current="volunteers" />
      <VolunteerRoster />
    </main>
  );
}
