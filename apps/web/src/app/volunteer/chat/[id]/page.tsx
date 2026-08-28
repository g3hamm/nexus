import { notFound, redirect } from "next/navigation";
import { asConversationId, endonym, isPractice } from "@nexus/core";
import { findScenario } from "@nexus/practice";
import { ChatWindow } from "@/components/ChatWindow";
import { EnablementSidebar } from "@/components/EnablementSidebar";
import { PracticePanel } from "@/components/PracticePanel";
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
  // An admin session is not a volunteer session; see requireVolunteer.
  if (session?.role !== "volunteer") redirect("/volunteer/login");

  const conversation = await container().conversations.findById(asConversationId(id));
  if (!conversation) notFound();
  // A volunteer's session grants access to their own conversations and no
  // others. Anything else would make the audit log a fiction.
  if (conversation.volunteerId !== session.subject) redirect("/volunteer");

  // A practice session swaps the sidebar rather than adding a panel. The
  // enablement suggestions are genuinely useful during practice — learning to
  // read them is part of learning the job — but they are one keystroke away
  // and the frame that says "nobody is on the other end" must not be.
  const scenario = isPractice(conversation)
    ? findScenario(conversation.practiceScenario ?? "")
    : null;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-7xl">
      <div className="min-w-0 flex-1">
        <ChatWindow
          conversationId={id}
          viewerRole="volunteer"
          peerName={scenario ? null : conversation.seekerName}
        />
      </div>
      <aside className="border-line hidden w-80 shrink-0 border-l lg:block xl:w-96">
        {scenario ? (
          <PracticePanel conversationId={id} title={scenario.title} />
        ) : (
          <EnablementSidebar
            conversationId={id}
            seekerLanguage={endonym(conversation.seekerLanguage)}
          />
        )}
      </aside>
    </div>
  );
}
