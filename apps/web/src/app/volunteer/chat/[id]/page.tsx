import { notFound, redirect } from "next/navigation";
import { asConversationId, endonym, isPractice } from "@nexus/core";
import { findAcademyModule } from "@nexus/academy";
import { findScenario } from "@nexus/practice";
import { ChatWindow } from "@/components/ChatWindow";
import { EnablementSidebar } from "@/components/EnablementSidebar";
import { PracticePanel } from "@/components/PracticePanel";
import { VolunteerWorkspace } from "@/components/VolunteerWorkspace";
import { container } from "@/server/container";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function VolunteerChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ module?: string }>;
}) {
  const { id } = await params;
  const { module: moduleId } = await searchParams;

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

  // An exercise started from an Academy module carries the module in the URL,
  // so the panel can offer the way back and the debrief can be marked against
  // what the volunteer had just read. Trusted no further than that: the id is
  // re-checked against the scenario server-side before it steers anything.
  const academyModule =
    scenario && moduleId ? (findAcademyModule(moduleId)?.module ?? null) : null;

  return (
    <VolunteerWorkspace
      panelLabel={scenario ? "Practice" : "Alongside you"}
      conversation={
        <ChatWindow
          conversationId={id}
          viewerRole="volunteer"
          peerName={scenario ? null : conversation.seekerName}
        />
      }
      panel={
        scenario ? (
          <PracticePanel
            conversationId={id}
            title={scenario.title}
            academyModule={
              academyModule ? { id: academyModule.id, title: academyModule.title } : null
            }
          />
        ) : (
          <EnablementSidebar
            conversationId={id}
            seekerLanguage={endonym(conversation.seekerLanguage)}
          />
        )
      }
    />
  );
}
