import { notFound, redirect } from "next/navigation";
import { asConversationId, endonym } from "@nexus/core";
import { ChatWindow } from "@/components/ChatWindow";
import { EnablementSidebar } from "@/components/EnablementSidebar";
import { container } from "@/server/container";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function VolunteerChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await staffSession();
  if (!session) redirect("/volunteer/login");

  const conversation = await container().conversations.findById(asConversationId(id));
  if (!conversation) notFound();
  // A volunteer's session grants access to their own conversations and no
  // others. Anything else would make the audit log a fiction.
  if (conversation.volunteerId !== session.subject) redirect("/volunteer");

  return (
    <div className="mx-auto flex h-dvh w-full max-w-7xl">
      <div className="min-w-0 flex-1">
        <ChatWindow conversationId={id} viewerRole="volunteer" />
      </div>
      <aside className="border-line hidden w-80 shrink-0 border-l lg:block xl:w-96">
        <EnablementSidebar
          conversationId={id}
          seekerLanguage={endonym(conversation.seekerLanguage)}
        />
      </aside>
    </div>
  );
}
