import Image from "next/image";

/**
 * Short, calm reminders — the kind of thing a trainer would say in passing,
 * not a rule. Nothing here is specific to a denomination or a technique;
 * all of it is safe to say to a volunteer who has never had a conversation
 * like this before.
 */
const TIPS = [
  "Short replies keep a conversation going better than long ones. Ask, then listen.",
  "It's alright to say \"I don't know.\" Honesty builds more trust than a quick answer.",
  "Silence can mean someone is typing something hard. Give it a moment before following up.",
  "You don't need the perfect verse. A steady, kind presence says more than a citation.",
  "If a conversation ever feels unsafe, you can end it — nobody expects you to stay.",
] as const;

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((today - start) / 86_400_000);
}

/**
 * One tip, changing daily rather than randomly. This is a Server Component
 * with no client state to pick a new one on each render, and the queue
 * above it already polls every 5s — a tip that reshuffled on every poll
 * would read as jittery rather than encouraging.
 */
export function VolunteerTip() {
  const tip = TIPS[dayOfYear(new Date()) % TIPS.length] ?? TIPS[0];

  return (
    <div className="bg-surface-sunken mx-auto flex w-full max-w-4xl items-center gap-3 rounded-lg px-5 py-4">
      <Image src="/tip.png" alt="" width={28} height={28} className="size-7 shrink-0" />
      <p className="text-ink-muted">
        <span className="font-medium">Tip:</span> {tip}
      </p>
    </div>
  );
}
