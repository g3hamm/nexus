import { describe, expect, it, vi } from "vitest";
import { NexusError } from "@nexus/core";
import { errorResponse } from "./http";

/** What node-postgres actually throws for a column that is not there. */
function undefinedColumn(): Error & { code: string } {
  return Object.assign(new Error('column "seeker_name_ciphertext" does not exist'), {
    code: "42703",
  });
}

describe("errorResponse", () => {
  it("names a database that is behind the code, and how to fix it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = errorResponse(undefinedColumn());
    const body = (await response.json()) as { error: { code: string; message: string } };

    // 503, not 500: this is a deployment that will work once the operator acts,
    // not a bug in the request.
    expect(response.status).toBe(503);
    expect(body.error.code).toBe("schema_behind");
    expect(body.error.message).toMatch(/setup\.sql/);
  });

  // Drizzle wraps the driver error, so the code is never on the top-level throw.
  it("finds the cause through a wrapper", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const wrapped = Object.assign(new Error("Failed query: select ..."), {
      cause: undefinedColumn(),
    });

    expect(errorResponse(wrapped).status).toBe(503);
  });

  it("does not mistake an ordinary failure for a missing migration", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = errorResponse(new Error("connection reset"));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("internal");
  });

  it("leaves a deliberate NexusError alone", async () => {
    const response = errorResponse(NexusError.forbidden("Not your conversation"));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("forbidden");
  });

  // A stack trace here can quote conversation content.
  it("never leaks the underlying message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = errorResponse(new Error("she said she has pills in front of her"));
    expect(JSON.stringify(await response.json())).not.toContain("pills");
  });
});
