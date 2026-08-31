import { errorResponse, ok } from "@/server/http";
import { clearStaffCookie } from "@/server/session";

export const runtime = "nodejs";

/**
 * Sign out.
 *
 * Deliberately unauthenticated: whether or not the cookie still verifies,
 * the right answer to "get me out" is to remove it. Requiring a valid
 * session here would mean an expired or malformed one could not be cleared,
 * which is the exact situation someone is usually in when they reach for
 * this.
 *
 * POST rather than GET so a prefetch, a preview crawler, or an image tag
 * pointed at this URL cannot sign a volunteer out. The session cookie is
 * `sameSite: lax`, so a cross-site POST does not carry it and cannot clear
 * anything either.
 *
 * It clears the staff cookie, which admins share — one browser holds one
 * staff session at a time (see `requireVolunteer`), so there is nothing
 * volunteer-specific to scope this to.
 */
export async function POST() {
  try {
    await clearStaffCookie();
    return ok({ signedOut: true });
  } catch (error) {
    return errorResponse(error);
  }
}
