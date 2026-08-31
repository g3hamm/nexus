"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@nexus/ui";
import { ICON_PROPS } from "./CornerLink";

/** The volunteer's two standing destinations, in both layouts. */
const DESTINATIONS = [
  { href: "/volunteer/academy", icon: "/academy-icon.png", label: "Academy" },
  { href: "/volunteer/practice", icon: "/practice-icon.png", label: "Practice" },
] as const;

/**
 * Ends the session and sends the volunteer to the sign-in page.
 *
 * `router.refresh()` after the push matters: every volunteer page is a
 * Server Component reading the cookie, and without it the client router
 * could serve a cached render of a page this browser is no longer allowed
 * to see. The redirect target is the login page rather than the front door
 * — someone signing out of a shift is far more likely to be handing the
 * device to the next volunteer than to be leaving as a seeker.
 */
function useSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return {
    busy,
    signOut: async () => {
      setBusy(true);
      try {
        await fetch("/api/volunteer/logout", { method: "POST" });
      } finally {
        // Even if the request failed, send them on. A volunteer who asked
        // to leave should not be parked on their queue looking at someone
        // else's conversations while we retry something.
        router.push("/volunteer/login");
        router.refresh();
      }
    },
  };
}

function SignOutIcon({ className }: { readonly className: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <path d="M6 14H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2H6M11 11l3-3-3-3M14 8H6" />
    </svg>
  );
}

/**
 * A CSS mask rather than the image itself — see `BrandFooter` for the full
 * reasoning. It reads only the file's shape and paints it in a token
 * colour, so these glyphs track the ink around them instead of being stuck
 * at whatever tone they were drawn in. The URL differs per icon, so unlike
 * the footer's fixed Tailwind classes it has to be set inline.
 */
function MaskIcon({ icon, className }: { readonly icon: string; readonly className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block shrink-0 [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
        className,
      )}
      style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
    />
  );
}

/** The wide-screen form: a labelled tile per destination. */
function NavIconLink({
  href,
  icon,
  label,
}: {
  readonly href: string;
  readonly icon: string;
  readonly label: string;
}) {
  return (
    <Link
      href={href}
      className="group border-line hover:border-line-strong bg-surface/70 ease-calm flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border px-5 py-3 transition-colors duration-200"
    >
      <MaskIcon
        icon={icon}
        className="bg-ink-muted group-hover:bg-ink ease-calm size-9 transition-colors duration-200"
      />
      <span className="text-ink-muted group-hover:text-ink text-sm font-medium">
        {label}
      </span>
    </Link>
  );
}

/**
 * The same destinations behind one button, for a phone.
 *
 * Two labelled tiles and an avatar cost a whole band across the top of a
 * narrow screen and pushed the greeting — and with it the conversations
 * that are the actual point of this page — down out of the first glance.
 *
 * The avatar does not come along. It is decoration today, with nothing to
 * link to, and every row in an open menu reads as something you can tap; a
 * row that does nothing is a worse lie in a menu than an ornament is in a
 * header. When a real profile page exists it becomes a third entry here,
 * with the avatar as its mark.
 */
function MobileMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { busy, signOut } = useSignOut();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0 sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Menu"}
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="border-line hover:border-line-strong text-ink-muted hover:text-ink bg-surface/70 ease-calm flex size-11 items-center justify-center rounded-lg border transition-colors duration-200"
      >
        {/* Spread first, then override: `ICON_PROPS` carries a size meant for
            inline marks, and two conflicting size utilities on one element
            leaves stylesheet order to decide which wins. */}
        <svg {...ICON_PROPS} className="size-5">
          {open ? (
            <path d="M4 4l8 8M12 4l-8 8" />
          ) : (
            <path d="M2 4h12M2 8h12M2 12h12" />
          )}
        </svg>
      </button>

      {open ? (
        <div className="border-line bg-surface shadow-lifted absolute end-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-lg border">
          {DESTINATIONS.map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="text-ink hover:bg-surface-sunken ease-calm flex items-center gap-3 px-4 py-3 transition-colors duration-200"
            >
              <MaskIcon icon={icon} className="bg-ink-muted size-6" />
              <span className="font-medium">{label}</span>
            </Link>
          ))}

          {/* Ruled off from the destinations above: leaving is a different
              kind of thing from going somewhere, and on a phone this row is
              a thumb's width from the two a volunteer actually reaches for. */}
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={busy}
            className="border-line text-ink hover:bg-surface-sunken ease-calm flex w-full items-center gap-3 border-t px-4 py-3 text-start transition-colors duration-200 disabled:opacity-60"
          >
            <SignOutIcon className="text-ink-muted size-6" />
            <span className="font-medium">Sign out</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The volunteer's standing destinations, in whichever form the screen has
 * room for.
 *
 * Rendered inside the greeting's row so the phone's button lines up with it
 * without any positioning arithmetic; the wide-screen cluster then escapes
 * that row with `absolute` to sit in the page's own top-right corner, the
 * same place and offsets as the front door's "Sign In".
 */
function SignOutTile() {
  const { busy, signOut } = useSignOut();
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className="group border-line hover:border-line-strong bg-surface/70 ease-calm flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border px-5 py-3 transition-colors duration-200 disabled:opacity-60"
    >
      <SignOutIcon className="text-ink-muted group-hover:text-ink ease-calm size-9 transition-colors duration-200" />
      <span className="text-ink-muted group-hover:text-ink text-sm font-medium">
        Sign out
      </span>
    </button>
  );
}

export function VolunteerNav() {
  return (
    <>
      <nav className="hidden sm:absolute sm:end-5 sm:top-5 sm:z-10 sm:flex sm:items-center sm:gap-3">
        {DESTINATIONS.map((destination) => (
          <NavIconLink key={destination.href} {...destination} />
        ))}
        {/* Decorative for now — no link, no click handler. A real
            profile/preferences page is planned; the avatar becomes that
            entry point once it exists, not before. */}
        <Image
          src="/user-avatar.png"
          alt=""
          width={72}
          height={72}
          className="size-[4.5rem] shrink-0 rounded-full"
        />
        <SignOutTile />
      </nav>

      <MobileMenu />
    </>
  );
}
