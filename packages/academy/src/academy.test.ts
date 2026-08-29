import { describe, expect, it } from "vitest";
import { PRACTICE_SCENARIOS } from "@nexus/practice";
import { ACADEMY_TRACKS } from "./curriculum.js";
import { academyProgress, briefForExercise, findAcademyModule } from "./index.js";
import { parseInline, parseModuleBody } from "./markdown.js";

const MODULES = ACADEMY_TRACKS.flatMap((track) => track.modules);

describe("curriculum", () => {
  it("has track and module ids that are unique and url-safe", () => {
    const trackIds = ACADEMY_TRACKS.map((t) => t.id);
    const moduleIds = MODULES.map((m) => m.id);

    expect(new Set(trackIds).size).toBe(trackIds.length);
    // Module ids are the URL, and are looked up across every track.
    expect(new Set(moduleIds).size).toBe(moduleIds.length);
    for (const id of [...trackIds, ...moduleIds]) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(MODULES)("$id has a title and a summary", (module) => {
    expect(module.title.trim().length).toBeGreaterThan(0);
    expect(module.summary.trim().length).toBeGreaterThan(0);
  });

  // The page promises a volunteer that "published" means readable. If a module
  // claims that status with no body, they get an empty page and stop trusting
  // the labels — which are the only thing telling them what is finished.
  it.each(MODULES)("$id matches its own status", (module) => {
    if (module.status === "published") {
      expect(module.body?.trim().length ?? 0).toBeGreaterThan(0);
      expect(module.source?.trim().length ?? 0).toBeGreaterThan(0);
      expect(module.minutes ?? 0).toBeGreaterThan(0);
    } else {
      expect(module.body).toBeUndefined();
    }
  });

  // Cross-links break silently: a renamed scenario leaves a module offering an
  // exercise that cannot start, and nobody notices until a volunteer clicks it.
  it.each(MODULES)("$id sets exercises that exist", (module) => {
    for (const id of module.exercises ?? []) {
      expect(PRACTICE_SCENARIOS.map((s) => s.id)).toContain(id);
    }
  });

  it("finds a module in any track, and nothing for an unknown id", () => {
    const found = findAcademyModule("when-not-to-argue");
    expect(found?.track.id).toBe("craft");
    expect(found?.module.title).toBe("When not to argue");
    expect(findAcademyModule("no-such-module")).toBeUndefined();
  });

  it("counts what is written and what can be practised", () => {
    const progress = academyProgress();
    expect(progress.total).toBe(MODULES.length);
    expect(progress.published + progress.drafting + progress.planned).toBe(
      progress.total,
    );
    // The shell ships with real modules in it, not an empty outline.
    expect(progress.published).toBeGreaterThan(0);
    // And with more of them practisable than readable, which is the point of
    // separating the two: an unwritten module can still be worth doing.
    expect(progress.withExercise).toBeGreaterThan(progress.published);
  });
});

describe("marking an exercise against its module", () => {
  it("hands the debrief what the module was trying to teach", () => {
    const brief = briefForExercise("when-not-to-argue", "provocateur");
    expect(brief?.title).toBe("When not to argue");
    expect(brief?.teaches?.length).toBeGreaterThan(0);
  });

  // A volunteer arriving from the practice list, which is a normal way to
  // arrive. The debrief then marks the conversation and nothing else.
  it("is absent when no module was named", () => {
    expect(briefForExercise(undefined, "provocateur")).toBeUndefined();
  });

  // The pairing is checked rather than trusted. Accepting a mismatch would
  // anchor somebody's feedback to reading they never did, and quietly.
  it("drops a module that does not set that exercise", () => {
    expect(briefForExercise("when-not-to-argue", "grief-mother")).toBeUndefined();
    expect(briefForExercise("no-such-module", "provocateur")).toBeUndefined();
  });
});

describe("module markdown", () => {
  it("reads headings, paragraphs, lists and quotes", () => {
    const blocks = parseModuleBody(
      [
        "## A heading",
        "",
        "A paragraph that",
        "wraps across lines.",
        "",
        "- one, which also",
        "  wraps",
        "- two",
        "",
        "> pulled out",
        "",
        "### Smaller",
      ].join("\n"),
    );

    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "list",
      "quote",
      "heading",
    ]);

    const [first, paragraph, list, , smaller] = blocks;
    expect(first).toMatchObject({ type: "heading", level: 2 });
    // Wrapped source lines become one paragraph, so the author can wrap freely.
    expect(paragraph).toMatchObject({
      type: "paragraph",
      spans: [{ text: "A paragraph that wraps across lines.", bold: false }],
    });
    expect(list).toMatchObject({ type: "list" });
    if (list?.type === "list") {
      // A wrapped item stays one item. Breaking it into a stray paragraph is
      // the bug this catches, and it reads on the page as a rendering glitch.
      expect(list.items).toHaveLength(2);
      expect(list.items[0]).toEqual([
        { text: "one, which also wraps", bold: false, italic: false },
      ]);
    }
    expect(smaller).toMatchObject({ type: "heading", level: 3 });
  });

  it("splits bold and emphasised runs out of a line", () => {
    expect(parseInline("plain **bold** and *emphasis* here")).toEqual([
      { text: "plain ", bold: false, italic: false },
      { text: "bold", bold: true, italic: false },
      { text: " and ", bold: false, italic: false },
      { text: "emphasis", bold: false, italic: true },
      { text: " here", bold: false, italic: false },
    ]);
  });

  // The safe failure: unsupported or malformed input is shown verbatim rather
  // than silently swallowing the lead's words. A stray asterisk is far more
  // likely to be punctuation than a formatting mistake.
  it("leaves an unclosed marker alone", () => {
    expect(parseInline("what ** happens")).toEqual([
      { text: "what ** happens", bold: false, italic: false },
    ]);
    expect(parseInline("5 * 4 = 20")).toEqual([
      { text: "5 * 4 = 20", bold: false, italic: false },
    ]);
  });

  it("produces nothing for an empty body", () => {
    expect(parseModuleBody("")).toEqual([]);
    expect(parseModuleBody("\n\n  \n")).toEqual([]);
  });
});
