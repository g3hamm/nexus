import { NextResponse } from "next/server";
import { httpStatusFor, isNexusError } from "@nexus/core";

/**
 * One error shape for every route.
 *
 * Unexpected errors deliberately do not reach the client. A stack trace from
 * a failed decrypt or a database error can describe conversation content, and
 * this is not an app where a leaked internal message is a cosmetic problem.
 */
export function errorResponse(error: unknown): NextResponse {
  if (isNexusError(error)) {
    const headers: Record<string, string> = {};
    // Tell a well-behaved client exactly how long to wait rather than making
    // it guess and retry into the same wall.
    const retryAfter = error.detail.retryAfterSeconds;
    if (typeof retryAfter === "number") {
      headers["retry-after"] = String(retryAfter);
    }

    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: httpStatusFor(error.code), headers },
    );
  }

  if (isSchemaBehind(error)) {
    console.error("[nexus] the database is missing a column this build needs", error);
    return NextResponse.json(
      {
        error: {
          code: "schema_behind",
          message:
            "This deployment is newer than its database. Re-run docs/setup.sql " +
            "in the Neon SQL Editor, then reload. Nothing has been lost.",
        },
      },
      { status: 503 },
    );
  }

  console.error("[nexus] unhandled route error", error);
  return NextResponse.json(
    { error: { code: "internal", message: "Something went wrong" } },
    { status: 500 },
  );
}

/**
 * Is this a deploy that ran ahead of its migrations?
 *
 * Postgres 42703 is `undefined_column`, and in this codebase it means exactly
 * one thing: the code selects a column the database has not been given yet.
 * It has now happened twice, and both times it surfaced as a bare 500 with
 * nothing in the browser to say which of the many possible causes it was.
 *
 * Naming it is worth more than it looks. The people running this deploy do not
 * read server logs — the whole setup path is a SQL file pasted into a web
 * editor — so an error that does not say "run the file again" is an error that
 * costs somebody an evening.
 *
 * Deliberately narrow. It matches the driver's error code, not a message
 * substring, and it does not try to guess at any other class of failure.
 */
function isSchemaBehind(error: unknown): boolean {
  for (let cause: unknown = error, depth = 0; cause && depth < 5; depth++) {
    if (typeof cause === "object" && (cause as { code?: unknown }).code === "42703") {
      return true;
    }
    cause = (cause as { cause?: unknown }).cause;
  }
  return false;
}

export function ok<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}
