import { SeekerEntry } from "@/components/SeekerEntry";

/**
 * The seeker's first and only instruction: say something.
 *
 * No sign-up, no language picker, no explanation of what this is. The brief
 * was that someone anywhere should be able to use this with no instructions
 * beyond having a conversation, and every element added to this page is an
 * instruction. Their language comes from what they type.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full">
        <h1 className="text-ink text-balance text-center font-serif text-3xl leading-snug sm:text-4xl">
          Is something on your mind?
        </h1>
        <p className="text-ink-muted mt-4 text-center text-lg">
          Write in any language. Someone will be here to talk with you.
        </p>

        <div className="mt-10">
          <SeekerEntry />
        </div>

        <p className="text-ink-subtle mt-8 text-center text-sm">
          No account. No name. Nothing to sign up for.
        </p>
      </div>
    </main>
  );
}
