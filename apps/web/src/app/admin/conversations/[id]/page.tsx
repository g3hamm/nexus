import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { TranscriptReview } from "@/components/TranscriptReview";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const claims = await staffSession();
  if (claims?.role !== "admin") redirect("/admin/login");

  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <AdminNav current="flags" />
      <TranscriptReview conversationId={id} />
    </main>
  );
}
