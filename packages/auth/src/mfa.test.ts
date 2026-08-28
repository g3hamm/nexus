import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "./secret-box.js";
import { findRecoveryCode, generateRecoveryCodes, hashRecoveryCode } from "./recovery.js";

const SECRET = "a-session-secret-long-enough-to-be-real";

describe("sealing server-side secrets", () => {
  it("round-trips", () => {
    const sealed = sealSecret("JBSWY3DPEHPK3PXP", SECRET);
    expect(openSecret(sealed, SECRET)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("does not store the secret in readable form", () => {
    // The point: a leaked database must not hand over password hashes and
    // the second factor meant to survive them.
    expect(sealSecret("JBSWY3DPEHPK3PXP", SECRET)).not.toContain("JBSWY3DP");
  });

  it("produces a different ciphertext each time", () => {
    expect(sealSecret("same", SECRET)).not.toBe(sealSecret("same", SECRET));
  });

  it("returns null for the wrong key rather than throwing", () => {
    // A rotated session secret should not turn every sign-in into a 500.
    const sealed = sealSecret("value", SECRET);
    expect(openSecret(sealed, "a-completely-different-secret-value")).toBeNull();
  });

  it("returns null for tampered or malformed input", () => {
    const sealed = sealSecret("value", SECRET);
    expect(openSecret(sealed.slice(0, -4) + "AAAA", SECRET)).toBeNull();
    expect(openSecret("not-sealed", SECRET)).toBeNull();
    expect(openSecret("", SECRET)).toBeNull();
  });

  it("keeps different purposes cryptographically separate", () => {
    // Same configured secret, different HKDF info — so one key never opens
    // the other's data.
    const sealed = sealSecret("value", SECRET, "nexus:totp");
    expect(openSecret(sealed, SECRET, "nexus:something-else")).toBeNull();
  });
});

describe("recovery codes", () => {
  it("issues ten, and stores only hashes", () => {
    const { plaintext, hashes } = generateRecoveryCodes(SECRET);

    expect(plaintext).toHaveLength(10);
    expect(hashes).toHaveLength(10);
    for (const code of plaintext) {
      expect(hashes).not.toContain(code);
    }
  });

  it("formats them so they can be transcribed off a screen", () => {
    for (const code of generateRecoveryCodes(SECRET).plaintext) {
      expect(code).toMatch(/^[a-z0-9_-]{4}-[a-z0-9_-]{4}-[a-z0-9_-]{4}$/);
    }
  });

  it("issues distinct codes", () => {
    const { plaintext } = generateRecoveryCodes(SECRET);
    expect(new Set(plaintext).size).toBe(10);
  });

  it("finds the code that was used", () => {
    const { plaintext, hashes } = generateRecoveryCodes(SECRET);
    expect(findRecoveryCode(plaintext[4]!, hashes, SECRET)).toBe(4);
    expect(findRecoveryCode(plaintext[0]!, hashes, SECRET)).toBe(0);
  });

  it("accepts a code typed back without dashes or in another case", () => {
    const { plaintext, hashes } = generateRecoveryCodes(SECRET);
    const code = plaintext[2]!;

    expect(findRecoveryCode(code.replace(/-/g, ""), hashes, SECRET)).toBe(2);
    expect(findRecoveryCode(code.toUpperCase(), hashes, SECRET)).toBe(2);
    expect(findRecoveryCode(`  ${code}  `, hashes, SECRET)).toBe(2);
  });

  it("rejects a code that was not issued", () => {
    const { hashes } = generateRecoveryCodes(SECRET);
    expect(findRecoveryCode("aaaa-bbbb-cccc", hashes, SECRET)).toBeNull();
    expect(findRecoveryCode("", hashes, SECRET)).toBeNull();
  });

  it("rejects a valid code once its hash has been removed", () => {
    // Using a code must consume it; the caller deletes the matched hash.
    const { plaintext, hashes } = generateRecoveryCodes(SECRET);
    const used = plaintext[3]!;
    const remaining = hashes.filter((_, i) => i !== 3);

    expect(findRecoveryCode(used, remaining, SECRET)).toBeNull();
  });

  it("rejects codes from a different deployment's secret", () => {
    const { plaintext } = generateRecoveryCodes(SECRET);
    const elsewhere = generateRecoveryCodes("another-deployments-secret");
    expect(findRecoveryCode(plaintext[0]!, elsewhere.hashes, SECRET)).toBeNull();
  });

  it("hashes deterministically for the same secret", () => {
    expect(hashRecoveryCode("abcd-efgh-ijkl", SECRET)).toBe(
      hashRecoveryCode("abcd-efgh-ijkl", SECRET),
    );
  });
});
