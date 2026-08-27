import { Card } from "@nexus/ui";

/**
 * The volunteer sidebar — the layout, waiting for its engine.
 *
 * The three panels below are the agreed shape: scripture that fits this
 * moment, things worth asking or saying next, and a read on who the volunteer
 * is talking to. `LlmEnablementEngine` in @nexus/enablement fills them in
 * during wave two; this renders the frame so the chat column is already the
 * right width and nothing has to be re-laid-out later.
 *
 * The one rule that must survive implementation: every item here is something
 * the volunteer chooses to use. Nothing in this panel may post to the
 * conversation on its own.
 */
export function EnablementSidebar({
  conversationId,
  seekerLanguage,
}: {
  readonly conversationId: string;
  readonly seekerLanguage: string;
}) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div>
        <h2 className="text-ink font-serif text-lg">Alongside you</h2>
        <p className="text-ink-subtle mt-1 text-sm">
          They are writing in {seekerLanguage}.
        </p>
      </div>

      <PendingPanel
        title="Scripture"
        description="Passages that fit what is being said, with a note on why."
      />
      <PendingPanel
        title="Worth saying next"
        description="Questions, bridges, and cautions drawn from the knowledge base."
      />
      <PendingPanel
        title="Understanding"
        description="Where this person seems to be coming from, and what to be careful of."
      />

      <p className="text-ink-subtle mt-auto pt-4 text-xs">
        Nothing here is sent for you. You decide what to say.
      </p>

      <span className="sr-only">Conversation {conversationId}</span>
    </div>
  );
}

function PendingPanel({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <Card padded={false} className="bg-surface-sunken border-dashed p-4 shadow-none">
      <h3 className="text-ink text-sm font-medium">{title}</h3>
      <p className="text-ink-subtle mt-1 text-sm">{description}</p>
      <p className="text-ink-subtle mt-3 text-xs uppercase tracking-wide">Coming next</p>
    </Card>
  );
}
