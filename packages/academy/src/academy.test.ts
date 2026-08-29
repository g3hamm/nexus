import { describe, expect, it } from "vitest";
import { PRACTICE_SCENARIOS } from "@nexus/practice";
import { ACADEMY_TRACKS } from "./curriculum.js";
import { academyProgress, findAcademyLesson } from "./index.js";
import { parseInline, parseLesson } from "./markdown.js";

const LESSONS = ACADEMY_TRACKS.flatMap((track) => track.lessons);

describe("curriculum", () => {
  it("has track and lesson ids that are unique and url-safe", () => {
    const trackIds = ACADEMY_TRACKS.map((t) => t.id);
    const lessonIds = LESSONS.map((l) => l.id);

    expect(new Set(trackIds).size).toBe(trackIds.length);
    // Lesson ids are the URL, and are looked up across every track.
    expect(new Set(lessonIds).size).toBe(lessonIds.length);
    for (const id of [...trackIds, ...lessonIds]) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(LESSONS)("$id has a title and a summary", (lesson) => {
    expect(lesson.title.trim().length).toBeGreaterThan(0);
    expect(lesson.summary.trim().length).toBeGreaterThan(0);
  });

  // The page promises a volunteer that "published" means readable. If a lesson
  // claims that status with no body, they get an empty page and stop trusting
  // the labels — which are the only thing telling them what is finished.
  it.each(LESSONS)("$id matches its own status", (lesson) => {
    if (lesson.status === "published") {
      expect(lesson.body?.trim().length ?? 0).toBeGreaterThan(0);
      expect(lesson.source?.trim().length ?? 0).toBeGreaterThan(0);
      expect(lesson.minutes ?? 0).toBeGreaterThan(0);
    } else {
      expect(lesson.body).toBeUndefined();
    }
  });

  // Cross-links break silently: a renamed scenario leaves a lesson pointing at
  // nothing, and nobody notices until a volunteer clicks it.
  it.each(LESSONS)("$id links only to practice scenarios that exist", (lesson) => {
    for (const id of lesson.practiceScenarioIds ?? []) {
      expect(PRACTICE_SCENARIOS.map((s) => s.id)).toContain(id);
    }
  });

  it("finds a lesson in any track, and nothing for an unknown id", () => {
    const found = findAcademyLesson("when-not-to-argue");
    expect(found?.track.id).toBe("craft");
    expect(found?.lesson.title).toBe("When not to argue");
    expect(findAcademyLesson("no-such-lesson")).toBeUndefined();
  });

  it("counts what is written and what is not", () => {
    const progress = academyProgress();
    expect(progress.total).toBe(LESSONS.length);
    expect(progress.published + progress.drafting + progress.planned).toBe(
      progress.total,
    );
    // The shell ships with real lessons in it, not an empty outline.
    expect(progress.published).toBeGreaterThan(0);
  });
});

describe("lesson markdown", () => {
  it("reads headings, paragraphs, lists and quotes", () => {
    const blocks = parseLesson(
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
    expect(parseLesson("")).toEqual([]);
    expect(parseLesson("\n\n  \n")).toEqual([]);
  });
});
