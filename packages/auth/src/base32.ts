/**
 * RFC 4648 base32, which is what authenticator apps expect a TOTP secret in.
 *
 * Written out rather than pulled in, because it is thirty lines and the
 * alternative is a dependency in the authentication path — the one place in
 * this codebase where an unreviewed transitive package is least welcome.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];

  return output;
}

export function base32Decode(encoded: string): Uint8Array {
  // Authenticator apps and QR readers hand back spacing and padding freely.
  const clean = encoded.toUpperCase().replace(/[=\s-]/g, "");

  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Uint8Array.from(output);
}
