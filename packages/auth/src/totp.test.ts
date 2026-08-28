import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode } from "./base32.js";
import {
  generateTotpSecret,
  totpCodeAt,
  totpProvisioningUri,
  verifyTotp,
} from "./totp.js";

/**
 * The RFC's own seed: the ASCII string "12345678901234567890", base32-encoded.
 * Every published test vector below is keyed to it.
 */
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("base32", () => {
  it("matches the RFC 4648 test vectors", () => {
    expect(base32Encode(Buffer.from("f"))).toBe("MY");
    expect(base32Encode(Buffer.from("fo"))).toBe("MZXQ");
    expect(base32Encode(Buffer.from("foo"))).toBe("MZXW6");
    expect(base32Encode(Buffer.from("foob"))).toBe("MZXW6YQ");
    expect(base32Encode(Buffer.from("fooba"))).toBe("MZXW6YTB");
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });

  it("round-trips arbitrary bytes", () => {
    const bytes = Uint8Array.from([0, 1, 127, 128, 255, 42, 7]);
    expect(Array.from(base32Decode(base32Encode(bytes)))).toEqual(Array.from(bytes));
  });

  it("tolerates the spacing and padding apps hand back", () => {
    const expected = Array.from(base32Decode("MZXW6YTBOI"));
    expect(Array.from(base32Decode("mzxw 6ytb oi"))).toEqual(expected);
    expect(Array.from(base32Decode("MZXW-6YTB-OI"))).toEqual(expected);
    expect(Array.from(base32Decode("MZXW6YTBOI======"))).toEqual(expected);
  });

  it("rejects characters that are not base32", () => {
    expect(() => base32Decode("MZXW6YTB01")).toThrow(/Invalid base32/);
  });
});

describe("HOTP, against the RFC 4226 test vectors", () => {
  // Counter values map to time by counter * 30 seconds, so these exercise the
  // same truncation the TOTP vectors do.
  const expected = [
    "755224",
    "287082",
    "359152",
    "969429",
    "338314",
    "254676",
    "287922",
    "162583",
    "399871",
    "520489",
  ];

  it.each(expected.map((code, counter) => ({ counter, code })))(
    "counter $counter produces $code",
    ({ counter, code }) => {
      expect(totpCodeAt(RFC_SECRET, counter * 30 * 1000)).toBe(code);
    },
  );
});

describe("TOTP, against the RFC 6238 test vectors", () => {
  /**
   * The RFC prints eight-digit codes; Nexus uses six, and the six-digit code
   * is the last six digits of the eight — truncation is `binary % 10^digits`,
   * so `(x % 1e8) % 1e6 === x % 1e6`.
   */
  const vectors = [
    { seconds: 59, eight: "94287082" },
    { seconds: 1111111109, eight: "07081804" },
    { seconds: 1111111111, eight: "14050471" },
    { seconds: 1234567890, eight: "89005924" },
    { seconds: 2000000000, eight: "69279037" },
    { seconds: 20000000000, eight: "65353130" },
  ];

  it.each(vectors)("at $seconds seconds", ({ seconds, eight }) => {
    expect(totpCodeAt(RFC_SECRET, seconds * 1000)).toBe(eight.slice(-6));
  });
});

describe("verifyTotp", () => {
  const now = 1111111109 * 1000;

  it("accepts the current code", () => {
    expect(verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, now), { atMs: now })).toBe(true);
  });

  it("accepts one step either side, for clock drift", () => {
    // A code typed at :29 and submitted at :31 must still work, or people
    // turn MFA off.
    const step = 30_000;
    expect(
      verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, now - step), { atMs: now }),
    ).toBe(true);
    expect(
      verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, now + step), { atMs: now }),
    ).toBe(true);
  });

  it("rejects codes further out than the window", () => {
    const step = 30_000;
    expect(
      verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, now - 2 * step), { atMs: now }),
    ).toBe(false);
    expect(
      verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, now + 2 * step), { atMs: now }),
    ).toBe(false);
  });

  it("rejects a wrong code", () => {
    expect(verifyTotp(RFC_SECRET, "000000", { atMs: now })).toBe(false);
  });

  it("rejects anything that is not six digits", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 56 78", "12345a"]) {
      expect(verifyTotp(RFC_SECRET, bad, { atMs: now })).toBe(false);
    }
  });

  it("tolerates the spaces authenticator apps display", () => {
    const code = totpCodeAt(RFC_SECRET, now);
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(verifyTotp(RFC_SECRET, spaced, { atMs: now })).toBe(true);
  });

  it("rejects a code from a different secret", () => {
    const other = generateTotpSecret();
    expect(verifyTotp(RFC_SECRET, totpCodeAt(other, now), { atMs: now })).toBe(false);
  });
});

describe("generateTotpSecret", () => {
  it("produces 160 bits, which is what SHA-1 TOTP assumes", () => {
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });

  it("is different every time", () => {
    const secrets = new Set(Array.from({ length: 200 }, generateTotpSecret));
    expect(secrets.size).toBe(200);
  });
});

describe("totpProvisioningUri", () => {
  it("is a URI an authenticator app can read", () => {
    const uri = totpProvisioningUri("JBSWY3DPEHPK3PXP", "root@example.org");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=Nexus");
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });

  it("escapes the label, so an email with a colon cannot break it", () => {
    expect(totpProvisioningUri("ABC", "a:b@example.org")).toContain("Nexus%3Aa%3Ab");
  });
});
