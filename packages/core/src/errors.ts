/**
 * Typed errors, so callers can branch on a code rather than on a message.
 */

export type NexusErrorCode =
  | "not_found"
  | "conflict"
  | "unauthorized"
  | "forbidden"
  | "validation_failed"
  | "provider_unavailable"
  | "provider_refused"
  | "rate_limited"
  | "crypto_failure"
  | "not_implemented";

export class NexusError extends Error {
  readonly code: NexusErrorCode;
  readonly detail: Readonly<Record<string, unknown>>;

  constructor(
    code: NexusErrorCode,
    message: string,
    detail: Readonly<Record<string, unknown>> = {},
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "NexusError";
    this.code = code;
    this.detail = detail;
  }

  static notFound(what: string, id?: string): NexusError {
    return new NexusError("not_found", `${what} not found`, id ? { id } : {});
  }

  static conflict(message: string, detail?: Record<string, unknown>): NexusError {
    return new NexusError("conflict", message, detail ?? {});
  }

  static unauthorized(message = "Authentication required"): NexusError {
    return new NexusError("unauthorized", message);
  }

  static forbidden(message = "Not permitted"): NexusError {
    return new NexusError("forbidden", message);
  }

  static validation(message: string, detail?: Record<string, unknown>): NexusError {
    return new NexusError("validation_failed", message, detail ?? {});
  }

  static notImplemented(what: string): NexusError {
    return new NexusError("not_implemented", `${what} is not implemented yet`);
  }
}

export function isNexusError(e: unknown): e is NexusError {
  return e instanceof NexusError;
}

/** Maps a domain error code onto an HTTP status, for route handlers. */
export function httpStatusFor(code: NexusErrorCode): number {
  switch (code) {
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "validation_failed":
      return 422;
    case "rate_limited":
      return 429;
    case "provider_unavailable":
    case "provider_refused":
      return 503;
    case "not_implemented":
      return 501;
    case "crypto_failure":
      return 500;
    default:
      return 500;
  }
}
