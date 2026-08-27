import type { NextRequest } from "next/server";
import { z } from "zod";
import { hashPassword } from "@nexus/auth";
import { NexusError, RATE_LIMITS, languageCodeSchema } from "@nexus/core";
import { container } from "@/server/container";
import { errorResponse, ok } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  displayName: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(12).max(200),
  languages: z.array(languageCodeSchema).min(1).max(10),
  // Short on purpose. This is a note for whoever vets them, not an essay.
  note: z.string().min(20).max(1500),
});

/**
 * A volunteer applies.
 *
 * Creates an account that can do nothing at all until an administrator
 * approves it. That is the safety model rather than a formality — approval is
 * the only point at which a human decides who gets to speak to seekers — so
 * open applications are safe in a way that open *access* would not be.
 *
 * Deliberately says when an email is already registered. It leaks that an
 * address belongs to a volunteer, which for this platform is a much smaller
 * risk than for a seeker, and the alternative is someone who mistyped their
 * address waiting forever for approval of an account that was never created.
 */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, RATE_LIMITS.volunteerApply);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw NexusError.validation(
        "Check the form: a name, a valid email, at least 12 characters of " +
          "password, one language, and a short note about yourself.",
      );
    }

    const c = container();
    const { displayName, email, password, languages, note } = parsed.data;

    if (await c.volunteers.findByEmail(email)) {
      throw NexusError.conflict(
        "There is already an application for that email address.",
      );
    }

    const volunteer = await c.volunteers.create({
      displayName,
      email,
      passwordHash: await hashPassword(password),
      languages,
      // Never approved on creation. Only an administrator does that.
      approved: false,
      applicationNote: note,
    });

    await c.audit.record({
      action: "volunteer.applied",
      actorRole: "system",
      actorId: null,
      conversationId: null,
      detail: { volunteerId: volunteer.id, languages },
    });

    return ok({ applied: true }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
