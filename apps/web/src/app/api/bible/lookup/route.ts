import type { NextRequest } from "next/server";
import { z } from "zod";
import { NexusError, formatReference, languageCodeSchema } from "@nexus/core";
import { container } from "@/server/container";
import { errorResponse, ok } from "@/server/http";
import { seekerSession, staffSession } from "@/server/session";

export const runtime = "nodejs";

const querySchema = z.object({
  book: z.string().min(1).max(10),
  chapter: z.coerce.number().int().min(1).max(150),
  verse: z.coerce.number().int().min(1).max(200).nullable().optional(),
  endVerse: z.coerce.number().int().min(1).max(200).nullable().optional(),
  language: languageCodeSchema.optional(),
});

/**
 * Looks up a passage for the hover card.
 *
 * Requires a session of some kind — seeker, volunteer or admin — because an
 * open scripture proxy is a free API somebody else pays for. It deliberately
 * does not check *which* conversation the caller is in: a passage is public
 * text and reveals nothing about anyone.
 */
export async function GET(request: NextRequest) {
  try {
    const [seeker, staff] = await Promise.all([seekerSession(), staffSession()]);
    const claims = seeker ?? staff;
    if (!claims) throw NexusError.unauthorized("Sign in to look up scripture");

    const params = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      book: params.get("book"),
      chapter: params.get("chapter"),
      verse: params.get("verse") ?? undefined,
      endVerse: params.get("endVerse") ?? undefined,
      language: params.get("language") ?? undefined,
    });
    if (!parsed.success) throw NexusError.validation("Not a usable reference");

    const reference = {
      book: parsed.data.book,
      chapter: parsed.data.chapter,
      verse: parsed.data.verse ?? null,
      endVerse: parsed.data.endVerse ?? null,
    };

    // The reader's own language, falling back to whatever their session says.
    const language = parsed.data.language ?? claims.language ?? "en";

    const passage = await container().bible.lookup(reference, { language });

    if (!passage) {
      // A perfectly ordinary outcome — no translation loaded for that
      // language, or the reference does not exist. The card says so.
      return ok({ found: false, reference: formatReference(reference) });
    }

    return ok({
      found: true,
      reference: formatReference(reference),
      translationName: passage.translationName,
      translationId: passage.translationId,
      language: passage.language,
      copyright: passage.copyright,
      verses: passage.verses,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
