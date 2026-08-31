"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@nexus/ui";
import { ICON_PROPS } from "./CornerLink";

/** The volunteer's two standing destinations. */
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

/**
 * Everywhere a volunteer can go from here, behind one button.
 *
 * One menu at every width, rather than a row of labelled tiles on a wide
 * screen and a menu on a narrow one. Four separate controls for two
 * destinations, an ornament and a sign-out read as clutter across the top
 * of the page, and having the same thing behave two different ways meant
 * two layouts to keep honest for no gain — nothing here is reached often
 * enough to earn permanent space.
 *
 * The avatar rides in the button rather than sitting beside it. It has
 * nothing behind it yet, so it is decoration, and decoration does not get
 * its own slot in a corner this crowded — but it is also exactly what a
 * profile entry point looks like, so this is where that lands when there is
 * a page to open.
 */
export function VolunteerNav() {
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
    // In the greeting's row on a phone, so it lines up with it for free;
    // pinned to the page's own top-right corner on a wide screen, the same
    // place and offsets as the front door's "Sign In". Both positions are a
    // containing block, so the panel below hangs off either one.
    <div
      ref={root}
      className="relative shrink-0 sm:absolute sm:end-5 sm:top-5 sm:z-20"
    >
      <button
        type="button"
        aria-label={open ? "Close menu" : "Menu"}
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="border-line hover:border-line-strong bg-surface/70 ease-calm flex items-center gap-2 rounded-full border py-1.5 pe-1.5 ps-3.5 transition-colors duration-200"
      >
        {/* Spread first, then override: `ICON_PROPS` carries a size meant for
            inline marks, and two conflicting size utilities on one element
            leaves stylesheet order to decide which wins. */}
        <svg {...ICON_PROPS} className="text-ink-muted size-5">
          {open ? (
            <path d="M4 4l8 8M12 4l-8 8" />
          ) : (
            <path d="M2 4h12M2 8h12M2 12h12" />
          )}
        </svg>
        <Image
          src="/user-avatar.png"
          alt=""
          width={72}
          height={72}
          className="size-9 shrink-0 rounded-full sm:size-10"
        />
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
              kind of thing from going somewhere, and this row sits a thumb's
              width from the two a volunteer actually reaches for. */}
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
