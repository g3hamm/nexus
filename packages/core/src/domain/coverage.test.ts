import { describe, expect, it } from "vitest";
import { coverageStateFrom, someoneIsHere, type Coverage } from "./coverage.js";

const coverage = (freeNow: number, onlineNow: number): Coverage => ({
  state: coverageStateFrom(freeNow, onlineNow),
  freeNow,
  onlineNow,
});

describe("coverage state", () => {
  it("is open when someone is free", () => {
    expect(coverageStateFrom(1, 3)).toBe("open");
  });

  // The distinction the whole feature turns on. "Everyone is mid-conversation"
  // and "nobody is on" produce very different, and differently true, waiting
  // copy — and `findAvailable().length` alone cannot tell them apart.
  it("is busy when volunteers are on but none are free", () => {
    expect(coverageStateFrom(0, 4)).toBe("busy");
  });

  it("is closed when nobody is on", () => {
    expect(coverageStateFrom(0, 0)).toBe("closed");
  });

  it("prefers open over busy when both could apply", () => {
    expect(coverageStateFrom(2, 2)).toBe("open");
  });

  it.each([
    [1, 1, true],
    [0, 1, true],
    [0, 0, false],
  ])("someoneIsHere(%i free, %i online) is %s", (free, online, expected) => {
    expect(someoneIsHere(coverage(free, online))).toBe(expected);
  });
});
