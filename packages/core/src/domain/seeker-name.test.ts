import { describe, expect, it } from "vitest";
import { seekerNameSchema } from "./conversation.js";

describe("what a seeker may call themselves", () => {
  it("takes an ordinary name", () => {
    expect(seekerNameSchema.parse("Marisol")).toBe("Marisol");
  });

  it("trims the padding people leave behind", () => {
    expect(seekerNameSchema.parse("  Sara  ")).toBe("Sara");
  });

  it("collapses runs of whitespace into one space", () => {
    expect(seekerNameSchema.parse("Maria   del  Carmen")).toBe("Maria del Carmen");
  });

  it("accepts names in any script", () => {
    expect(seekerNameSchema.parse("سارا")).toBe("سارا");
    expect(seekerNameSchema.parse("小明")).toBe("小明");
  });

  it("rejects nothing at all", () => {
    expect(() => seekerNameSchema.parse("   ")).toThrow();
    expect(() => seekerNameSchema.parse("")).toThrow();
  });

  // The cap is the point: a field long enough for a sentence invites people to
  // put their situation in it, or their phone number — which is exactly what
  // this product spends its effort not storing.
  it("refuses anything longer than a form of address", () => {
    expect(() => seekerNameSchema.parse("a".repeat(41))).toThrow();
    expect(seekerNameSchema.parse("a".repeat(40))).toHaveLength(40);
  });
});
