import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { createKeyManagement } from "./factory.js";

const key = () => randomBytes(32).toString("base64");

describe("the production key-management guard", () => {
  it("refuses a local master key in production by default", () => {
    expect(() =>
      createKeyManagement({
        provider: "local",
        masterKeyBase64: key(),
        isProduction: true,
      }),
    ).toThrow(/Refusing to start/);
  });

  it("points at the trial escape hatch rather than leaving you stuck", () => {
    expect(() =>
      createKeyManagement({
        provider: "local",
        masterKeyBase64: key(),
        isProduction: true,
      }),
    ).toThrow(/NEXUS_ALLOW_INSECURE_LOCAL_KMS/);
  });

  it("allows it when explicitly opted into, and says so loudly", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const kms = createKeyManagement({
      provider: "local",
      masterKeyBase64: key(),
      isProduction: true,
      allowInsecureLocalKeyInProduction: true,
    });

    expect(kms.name).toBe("local");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toMatch(/INSECURE MASTER KEY/);
    warn.mockRestore();
  });

  it("does not warn outside production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createKeyManagement({
      provider: "local",
      masterKeyBase64: key(),
      isProduction: false,
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
