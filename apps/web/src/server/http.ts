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
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: httpStatusFor(error.code) },
    );
  }

  console.error("[nexus] unhandled route error", error);
  return NextResponse.json(
    { error: { code: "internal", message: "Something went wrong" } },
    { status: 500 },
  );
}

export function ok<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}
