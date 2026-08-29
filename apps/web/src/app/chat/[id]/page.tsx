import { notFound, redirect } from "next/navigation";
import { asConversationId } from "@nexus/core";
import { ChatWindow } from "@/components/ChatWindow";
import { container } from "@/server/container";
import { ExpiryService } from "@/server/expiry-service";
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

  const c = container();
  const found = await c.conversations.findById(asConversationId(id));
  if (!found) notFound();
  if (found.seekerId !== session.subject) redirect("/");

  // A conversation that went quiet closes here rather than on a schedule, and
  // stays readable for an hour afterwards so the last thing said to somebody
  // is still on screen. Past that the link is done and there is nothing to
  // show — which is the point of it being done.
  const conversation = await new ExpiryService(c).resolve(found);
  if (!conversation) redirect("/");

  return (
    <div className="h-dvh">
      <ChatWindow conversationId={id} viewerRole="seeker" />
    </div>
  );
}
