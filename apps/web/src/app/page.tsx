import type { CoverageState } from "@nexus/core";
import { SeekerEntry } from "@/components/SeekerEntry";
import { container } from "@/server/container";

/**
 * Re-rendered at most twice a minute.
 *
 * The front door should be the cheapest and fastest thing a distressed person
 * opens all day, so this is cached rather than rendered per visit. Coverage
 * being up to thirty seconds stale is harmless: the only thing it changes is
 * which true sentence appears under the box, and the conversation screen
 * corrects itself within seconds of the seeker arriving there.
 *
 * Caching does mean the build prerenders this page with no database to ask,
 * which is exactly why an unknown state has its own wording rather than a
 * default. See `invitationFor(null)`.
 */
export const revalidate = 30;

/**
 * The seeker's first and only instruction: say something.
 *
 * No sign-up, no language picker, no explanation of what this is. The brief
 * was that someone anywhere should be able to use this with no instructions
 * beyond having a conversation, and every element added to this page is an
 * instruction. Their language comes from what they type.
 *
 * The one thing that does change is the promise, because it has to be one we
 * can keep. See `invitationFor`.
 */
export default async function HomePage() {
  const coverage = await coverageState();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center px-6 py-12">
      <div className="w-full">
        <h1 className="text-ink text-balance text-center font-serif text-3xl leading-snug sm:text-4xl">
          Is something on your mind?
        </h1>
        <p className="text-ink-muted mt-4 text-center text-lg text-balance">
          {invitationFor(coverage)}
        </p>

        <div className="mt-10">
          <SeekerEntry />
        </div>

        {/* "No name" was true until the name became required. A reassurance
            that is no longer accurate is worse than none. */}
        <p className="text-ink-subtle mt-8 text-center text-sm">
          No account. No email. Nothing to sign up for.
        </p>

      </div>
    </main>
  );
}

/**
 * The sentence under the heading.
 *
 * "Someone will be here to talk with you" was here unconditionally, and at
 * three in the morning with nobody on shift it was simply false. Someone who
 * has worked themselves up to writing down the worst thing in their life, and
 * is then left watching a spinner that means nothing, has been treated badly
 * by this software.
 *
 * None of these turn anyone away. Writing it down has value even when nobody
 * is on, the message is genuinely waiting for whoever comes on next, and a
 * seeker's session lasts twelve hours — long enough that coming back on the
 * same device really does find the reply. The promise shrinks to fit the
 * truth; the invitation never does.
 */
function invitationFor(state: CoverageState | null): string {
  switch (state) {
    // We do not know — the build prerendering this page, or the database
    // being unreachable. Every other branch asserts something about who is on
    // shift, so this one asserts nothing: it is true in all three states and
    // in every failure, which is the only thing worth saying when you do not
    // know. It lasts until the first revalidation, thirty seconds later.
    case null:
      return "Write in any language. Someone will read this.";
    case "open":
      return "Write in any language. Someone is here to talk with you.";
    case "busy":
      return "Write in any language. Everyone here is with someone right now, and one of them will be with you as soon as they are free.";
    case "closed":
      return "Write in any language. Nobody is here at this hour, but what you write will be waiting for the first person who comes on.";
  }
}

/**
 * Fails to "unknown", never to an error page and never to a guess.
 *
 * A seeker's message is the thing that matters here; a coverage lookup is
 * decoration on top of it, and decoration must not be able to take the door
 * off its hinges. Guessing a state would be worse than admitting we have
 * none — the entire point of this feature is that the sentence under the box
 * is true.
 */
async function coverageState(): Promise<CoverageState | null> {
  try {
    return (await container().volunteers.coverage()).state;
  } catch (error) {
    console.error("[nexus] coverage lookup failed", { error });
    return null;
  }
}
