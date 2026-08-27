import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { NexusError } from "@nexus/core";
import { container } from "@/server/container";
import { errorResponse, ok } from "@/server/http";
import { RetentionService } from "@/server/retention-service";

export const runtime = "nodejs";
// Purging a large backlog can take a while; never let it be cut off halfway.
export const maxDuration = 300;

/**
 * Daily retention purge, invoked by Vercel Cron.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when that variable is set.
 * This route refuses to run without it — an unauthenticated endpoint that
 * deletes conversations is not something to leave lying around, and failing
 * closed on a misconfiguration is much safer here than failing open.
 */
export async function GET(request: NextRequest) {
  try {
    authorize(request);

    const service = new RetentionService(container());
    const result = await service.purgeExpired();

    if (result.reachedLimit) {
      // Worth saying out loud: the backlog was larger than one run handles, so
      // some conversations are still past their retention date.
      console.warn(
        `[nexus] retention purge hit its per-run ceiling after ${result.purged} ` +
          `conversations. More remain; the next run will continue.`,
      );
    }

    return ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}

function authorize(request: NextRequest): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new NexusError(
      "forbidden",
      "CRON_SECRET is not set, so the purge endpoint is disabled. Set it in " +
        "your environment — Vercel Cron sends it automatically as a bearer token.",
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";

  const a = Buffer.from(supplied);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw NexusError.unauthorized("Invalid cron credentials");
  }
}
