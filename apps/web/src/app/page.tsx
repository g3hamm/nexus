import Link from "next/link";
import type { CoverageState } from "@nexus/core";
import { BelongAnimation } from "@/components/BelongAnimation";
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
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-8 sm:py-12">
      {/* Volunteers arrive here too, and were expected to remember a URL
          nobody told them. Small, grey, and out of the way for the same
          reason every other element on this page had to justify itself — the
          visible text is as short as the rest of the chrome now, with the
          fuller wording kept for anyone tabbing through by screen reader,
          who cannot see that it sits apart from the box below.

          It points at /volunteer rather than the login page, so somebody
          already signed in lands on their queue instead of a form. No session
          is read here — that would make the front door dynamic, and this page
          is cached precisely so it is the fastest thing a distressed person
          opens all day. */}
      <Link
        href="/volunteer"
        aria-label="Volunteer sign in"
        className="text-ink-subtle hover:text-ink-muted absolute end-0 top-0 p-5 text-sm transition-colors"
      >
        Sign In
      </Link>

      <div className="w-full">
        {/* `min-h` reserves room for the longest translation wrapping onto a
            second line, so a language change mid-cycle cannot shove the
            subtitle and the form down the page while someone is reading. */}
        <h1 className="text-ink flex min-h-20 items-center justify-center text-balance text-center font-serif text-3xl leading-snug sm:min-h-24 sm:text-4xl">
          <BelongAnimation />
        </h1>

        {/* One warm line that is always true, and — beneath it, smaller — the
            one honest thing that changes: whether anyone can answer right
            now. Saying that plainly is worth more than a page that reads
            beautifully at 3am with nobody on shift. See `invitationFor`. */}
        <p className="text-ink mt-4 text-balance text-center text-lg">
          Come as you are. Talk with real Christians around the world.
        </p>
        <p className="text-ink-subtle mt-1.5 text-balance text-center text-sm">
          {invitationFor(coverage)}
        </p>

        <div className="mt-8">
          <SeekerEntry />
        </div>

        {/* "No name" was true until the name became required. A reassurance
            that is no longer accurate is worse than none. */}
        <p className="text-ink-subtle mt-6 text-center text-sm">
          No account. No email. Nothing to sign up for.
        </p>
      </div>
    </main>
  );
}

/**
 * The small line under the tagline — the one thing here that changes.
 *
 * "Someone will be here to talk with you" used to be the headline itself,
 * shown unconditionally, and at three in the morning with nobody on shift it
 * was simply false. Someone who has worked themselves up to writing down the
 * worst thing in their life, and is then left watching a spinner that means
 * nothing, has been treated badly by this software. It is smaller and
 * quieter now, but it still has to be true in all four states below —
 * tightening the wording is not licence to bring the old promise back.
 *
 * None of these turn anyone away. Writing it down has value even when nobody
 * is on, the message is genuinely waiting for whoever comes on next, and a
 * seeker's session lasts twelve hours — long enough that coming back on the
 * same device really does find the reply. The promise shrinks to fit the
 * truth; the invitation above it never does.
 */
function invitationFor(state: CoverageState | null): string {
  switch (state) {
    // We do not know — the build prerendering this page, or the database
    // being unreachable. Every other branch asserts something about who is on
    // shift, so this one asserts nothing: it is true in all three states and
    // in every failure, which is the only thing worth saying when you do not
    // know. It lasts until the first revalidation, thirty seconds later.
    case null:
      return "Write in any language — someone will read it.";
    case "open":
      return "Someone is here now.";
    case "busy":
      return "Everyone is with someone else right now, and you're next.";
    case "closed":
      return "No one is on right now, but your message will be waiting.";
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
