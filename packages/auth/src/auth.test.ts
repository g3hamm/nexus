import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";
import { SessionSigner } from "./session.js";
import { issueSeekerSession, newSeekerId } from "./seeker.js";

const SECRET = "a-test-secret-that-is-long-enough-to-pass";

describe("password hashing", () => {
  it("accepts the correct password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", stored)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("Correct horse battery staple", stored)).resolves.toBe(
      false,
    );
    await expect(verifyPassword("", stored)).resolves.toBe(false);
  });

  it("produces a different hash for the same password every time", async () => {
    const a = await hashPassword("correct horse battery staple");
    const b = await hashPassword("correct horse battery staple");
    expect(a).not.toBe(b);
    // Both still verify — the difference is the salt, not the password.
    await expect(verifyPassword("correct horse battery staple", a)).resolves.toBe(true);
    await expect(verifyPassword("correct horse battery staple", b)).resolves.toBe(true);
  });

  it("stores its cost parameters so they can be raised later", async () => {
    const stored = await hashPassword("correct horse battery staple");
    const [algorithm, n, r, p] = stored.split("$");
    expect(algorithm).toBe("scrypt");
    expect(Number(n)).toBe(32768);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "bcrypt$1$2$3$4$5")).resolves.toBe(false);
  });

  it("requires a password long enough to be worth hashing", async () => {
    await expect(hashPassword("short")).rejects.toThrow(/at least 12 characters/);
  });
});

describe("SessionSigner", () => {
  it("round-trips claims", async () => {
    const signer = new SessionSigner(SECRET);
    const token = await signer.sign(
      { subject: "vol-1", role: "volunteer", displayName: "Ana" },
      3600,
    );

    const claims = await signer.verify(token);
    expect(claims?.subject).toBe("vol-1");
    expect(claims?.role).toBe("volunteer");
    expect(claims?.displayName).toBe("Ana");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await new SessionSigner(SECRET).sign(
      { subject: "vol-1", role: "volunteer", displayName: "Ana" },
      3600,
    );

    const other = new SessionSigner("a-completely-different-secret-value-here");
    await expect(other.verify(token)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const signer = new SessionSigner(SECRET);
    const token = await signer.sign(
      { subject: "vol-1", role: "volunteer", displayName: "Ana" },
      -10,
    );
    await expect(signer.verify(token)).resolves.toBeNull();
  });

  it("rejects tampered and absent tokens", async () => {
    const signer = new SessionSigner(SECRET);
    const token = await signer.sign(
      { subject: "vol-1", role: "volunteer", displayName: "Ana" },
      3600,
    );

    await expect(signer.verify(token.slice(0, -4) + "AAAA")).resolves.toBeNull();
    await expect(signer.verify(undefined)).resolves.toBeNull();
    await expect(signer.verify("")).resolves.toBeNull();
  });

  it("refuses a secret too short to be worth signing with", () => {
    expect(() => new SessionSigner("tooshort")).toThrow(/at least 32 characters/);
  });
});

describe("seeker sessions", () => {
  it("issues a fresh handle every time, with no personal data", async () => {
    const signer = new SessionSigner(SECRET);

    const a = await issueSeekerSession(signer, "fa");
    const b = await issueSeekerSession(signer, "fa");
    expect(a.seekerId).not.toBe(b.seekerId);

    const claims = await signer.verify(a.token);
    expect(claims?.role).toBe("seeker");
    expect(claims?.language).toBe("fa");
    // The only name a volunteer ever sees.
    expect(claims?.displayName).toBe("Guest");
    expect(claims?.subject).toMatch(/^skr_/);
  });

  it("generates handles with no discernible ordering", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newSeekerId()));
    expect(ids.size).toBe(500);
  });
});
