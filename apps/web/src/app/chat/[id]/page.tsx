import { notFound, redirect } from "next/navigation";
import { asConversationId } from "@nexus/core";
import { ChatWindow } from "@/components/ChatWindow";
import { container } from "@/server/container";
import { seekerSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function SeekerChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await seekerSession();
  // No session means a stale link or a cleared cookie. Send them to the start
  // rather than showing an error — they can simply begin again.
  if (!session) redirect("/");

  const conversation = await container().conversations.findById(asConversationId(id));
  if (!conversation) notFound();
  if (conversation.seekerId !== session.subject) redirect("/");

  return (
    <div className="h-dvh">
      <ChatWindow conversationId={id} viewerRole="seeker" />
    </div>
  );
}
