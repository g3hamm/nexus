import Link from "next/link";
import type { CoverageState } from "@nexus/core";
import { cn } from "@nexus/ui";
import { BelongAnimation } from "@/components/BelongAnimation";
import { ArrowRightIcon, CORNER_PILL_CLASS } from "@/components/CornerLink";
import { FrontDoorTagline, NoAccountLine } from "@/components/FrontDoorCopy";
import { LanguageProvider } from "@/components/LanguageProvider";
import { LanguageSwitch } from "@/components/LanguageSwitch";
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
 * default. See `FrontDoorTagline`.
 */
export const revalidate = 30;

/**
 * The seeker's first and only instruction: say something.
 *
 * No sign-up, no language picker that gates anything, no explanation of what
 * this is. The brief was that someone anywhere should be able to use this
 * with no instructions beyond having a conversation, and every element added
 * to this page is an instruction. Their language for the actual conversation
 * still comes from what they type, exactly as before.
 *
 * `LanguageSwitch` does not contradict that — it exists for the person the
 * brief didn't cover: someone who cannot read "What can we call you?" in the
 * first place, and so cannot get as far as typing anything at all. See
 * `LanguageProvider` and `SEEKER_UI_STRINGS`.
 */
export default async function HomePage() {
  const coverage = await coverageState();

  return (
    <LanguageProvider>
      <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-8 sm:py-12">
        <LanguageSwitch />

        {/* Volunteers arrive here too, and were expected to remember a URL
            nobody told them. Small, grey, and out of the way for the same
            reason every other element on this page had to justify itself —
            the visible text is as short as the rest of the chrome now, with
            the fuller wording kept for anyone tabbing through by screen
            reader, who cannot see that it sits apart from the box below.

            It points at /volunteer rather than the login page, so somebody
            already signed in lands on their queue instead of a form. No
            session is read here — that would make the front door dynamic,
            and this page is cached precisely so it is the fastest thing a
            distressed person opens all day. */}
        <Link
          href="/volunteer"
          aria-label="Volunteer sign in"
          className={cn(CORNER_PILL_CLASS, "absolute end-5 top-5")}
        >
          Sign In
          <ArrowRightIcon />
        </Link>

        <div className="w-full">
          {/* `min-h` reserves room for the longest translation wrapping onto
              a second line, so a language change mid-cycle cannot shove the
              subtitle and the form down the page while someone is reading. */}
          <h1 className="text-ink flex min-h-20 items-center justify-center text-balance text-center font-serif text-3xl leading-snug sm:min-h-24 sm:text-4xl">
            <BelongAnimation />
          </h1>

          <FrontDoorTagline coverage={coverage} />

          <div className="mt-8">
            <SeekerEntry />
          </div>

          {/* "No name" was true until the name became required. A reassurance
              that is no longer accurate is worse than none. */}
          <NoAccountLine />
        </div>
      </main>
    </LanguageProvider>
  );
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
