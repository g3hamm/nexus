import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { hashPassword } from "@nexus/auth";
import { NexusError, isActiveVolunteer, languageCodeSchema } from "@nexus/core";
import { container } from "@/server/container";
import { env } from "@/server/env";
import { errorResponse, ok } from "@/server/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(1),
  displayName: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(12).max(200),
  languages: z.array(languageCodeSchema).min(1),
});

/**
 * Creates the very first volunteer, without a terminal.
 *
 * Three guards, and all three matter:
 *
 *   1. `NEXUS_SETUP_TOKEN` must be set. Without it this route does not exist
 *      as far as callers are concerned.
 *   2. The submitted token must match, compared in constant time.
 *   3. There must be zero volunteers. That is what makes this genuinely
 *      one-time rather than a permanent way to mint approved accounts.
 *
 * The account is approved on creation, which the normal path will not do —
 * vetting who speaks to seekers is the safety model. That is acceptable here
 * only because guard 3 means it can happen exactly once, to bootstrap.
 */
export async function POST(request: NextRequest) {
  try {
    const expected = env().NEXUS_SETUP_TOKEN;
    if (!expected) {
      throw NexusError.forbidden(
        "Setup is not enabled. Set NEXUS_SETUP_TOKEN to turn it on.",
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw NexusError.validation(
        "Check the form: a name, a valid email, at least 12 characters of " +
          "password, and one language are all required.",
      );
    }

    if (!tokensMatch(parsed.data.token, expected)) {
      throw NexusError.forbidden("That setup token is not correct.");
    }

    const c = container();

    // The one-time guard, in two parts.
    //
    // An administrator existing closes this route for good. A volunteer
    // existing does not — an install set up before the admin area was built
    // has a volunteer and no administrator, and with no administrator the
    // moderation queue is a room nobody can enter: flagged conversations are
    // held out of the retention purge waiting for a review that cannot happen.
    // Those installs need a way in that does not require a terminal, so setup
    // stays open just long enough to create the missing administrator.
    const [volunteerCount, adminCount] = await Promise.all([
      c.volunteers.count(),
      c.admins.count(),
    ]);

    if (adminCount > 0) {
      throw NexusError.conflict(
        "Setup has already been used. Remove NEXUS_SETUP_TOKEN — further " +
          "accounts are created by an administrator.",
      );
    }

    const adminOnly = volunteerCount > 0;

    // One password hash, two accounts.
    //
    // The person running setup is the operator: they need to answer seekers
    // *and* review what the judge flags, and those are separate roles with
    // separate sign-ins. Creating only the volunteer — which is what this did
    // originally — left the moderation queue with nobody able to open it, so
    // flagged conversations piled up unreviewable and, because review exempts
    // them from the purge, unpurgeable too.
    const passwordHash = await hashPassword(parsed.data.password);

    const volunteer = adminOnly
      ? null
      : await c.volunteers.create({
          displayName: parsed.data.displayName,
          email: parsed.data.email,
          passwordHash,
          languages: parsed.data.languages,
          approved: true,
        });

    const admin = await c.admins.create({
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      passwordHash,
    });

    // Verify the account this route exists to produce is actually usable.
    //
    // Not paranoia: an earlier version passed `approved: true` into a
    // repository that silently ignored it, so setup reported success and the
    // sign-in page then said the account was awaiting approval. The whole job
    // of this route is "make a working account", so it checks that it did.
    if (volunteer && !isActiveVolunteer(volunteer)) {
      throw new NexusError(
        "conflict",
        "The account was created but is not approved, so it cannot sign in. " +
          "This is a bug in Nexus, not something you did wrong. An admin can " +
          "approve it directly, or delete it and run setup again.",
        { volunteerId: volunteer?.id },
      );
    }

    await c.audit.record({
      action: "volunteer.approved",
      actorRole: "system",
      actorId: null,
      conversationId: null,
      detail: {
        via: adminOnly ? "administrator added to an existing install" : "first-run setup",
        volunteerId: volunteer?.id ?? null,
        adminId: admin.id,
      },
    });

    return ok(
      {
        id: volunteer?.id ?? admin.id,
        adminId: admin.id,
        email: admin.email,
        adminOnly,
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** Constant-time compare, so the token cannot be guessed a character at a time. */
function tokensMatch(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
