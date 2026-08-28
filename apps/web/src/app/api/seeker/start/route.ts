import type { NextRequest } from "next/server";
import { z } from "zod";
import { SEEKER_SESSION_TTL_SECONDS, issueSeekerSession } from "@nexus/auth";
import { languageCodeSchema, RATE_LIMITS, seekerNameSchema } from "@nexus/core";
import { container } from "@/server/container";
import { ConversationService } from "@/server/conversation-service";
import { errorResponse, ok } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { setSeekerCookie } from "@/server/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  /** What the seeker actually typed, used to detect their language. */
  firstMessage: z.string().min(1).max(4000).optional(),
  /** From `Accept-Language`, as a starting guess. */
  language: languageCodeSchema.optional(),
  /** What they would like to be called. Optional, and never verified. */
  name: seekerNameSchema.optional(),
});

/**
 * A seeker arrives.
 *
 * This is the whole onboarding flow. No account, no email, no language
 * dropdown — their language is inferred from what they typed, and they can
 * correct it afterwards if we guessed wrong.
 */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, RATE_LIMITS.seekerStart);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return ok({ error: { code: "validation_failed", message: "Bad request" } }, 422);
    }

    const c = container();
    const service = new ConversationService(c);

    let language = parsed.data.language ?? headerLanguage(request) ?? "en";

    // What they typed beats what their browser claims. People travel, borrow
    // phones, and use devices configured in a language they do not read.
    if (parsed.data.firstMessage) {
      try {
        const detected = await c.translator.detectLanguage(parsed.data.firstMessage);
        if (detected.confidence >= 0.6) language = detected.language;
      } catch {
        // Detection is a convenience. Fall back to the header guess.
      }
    }

    const { seekerId, token } = await issueSeekerSession(c.sessions, language);
    const { conversation } = await service.startForSeeker(
      seekerId,
      language,
      parsed.data.name,
    );

    await setSeekerCookie(token, SEEKER_SESSION_TTL_SECONDS);

    return ok({
      conversationId: conversation.id,
      language,
      status: conversation.status,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** First language in `Accept-Language`, as an initial guess only. */
function headerLanguage(request: NextRequest): string | null {
  const header = request.headers.get("accept-language");
  if (!header) return null;
  const first = header.split(",")[0]?.split(";")[0]?.trim();
  return first && first !== "*" ? first : null;
}
