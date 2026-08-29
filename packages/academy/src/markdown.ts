/**
 * A deliberately tiny markdown reader for lesson bodies.
 *
 * Lessons are written by an apologetics lead, not an engineer, so the source
 * format has to be something a person can type. But rendering arbitrary
 * markdown means either shipping a parser that emits HTML — which then has to
 * be sanitised, forever, correctly — or pulling in a dependency for the sake
 * of five constructs.
 *
 * So this parses a fixed subset into plain data, and the app renders that data
 * as React elements. No HTML is ever produced, which means there is no HTML to
 * sanitise and no `dangerouslySetInnerHTML` anywhere in the Academy.
 *
 * The subset, complete:
 *
 *   ## A heading            (### also works, and renders one level smaller)
 *   A paragraph, with **bold** and *emphasis* in it.
 *   - a list item, which may
 *     wrap onto further lines
 *   > a pulled-out line
 *
 * Anything else is treated as paragraph text and shown verbatim, which is the
 * safe failure: a lead who types something unsupported sees their own words on
 * the page rather than losing them.
 */

/** A run of text. Lessons need no inline formatting beyond these two. */
export interface InlineSpan {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
}

export type LessonBlock =
  | {
      readonly type: "heading";
      readonly level: 2 | 3;
      readonly spans: readonly InlineSpan[];
    }
  | { readonly type: "paragraph"; readonly spans: readonly InlineSpan[] }
  | { readonly type: "quote"; readonly spans: readonly InlineSpan[] }
  | { readonly type: "list"; readonly items: readonly (readonly InlineSpan[])[] };

/**
 * Splits a line into plain, bold and emphasised runs.
 *
 * Unmatched markers stay literal — a stray asterisk is far more likely to be
 * someone's punctuation than a formatting mistake, and swallowing it would
 * silently change what the lesson says.
 */
export function parseInline(line: string): readonly InlineSpan[] {
  const spans: InlineSpan[] = [];

  for (const piece of line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)) {
    if (piece.length === 0) continue;

    if (piece.startsWith("**") && piece.endsWith("**") && piece.length > 4) {
      spans.push({ text: piece.slice(2, -2), bold: true, italic: false });
    } else if (piece.startsWith("*") && piece.endsWith("*") && piece.length > 2) {
      spans.push({ text: piece.slice(1, -1), bold: false, italic: true });
    } else {
      spans.push({ text: piece, bold: false, italic: false });
    }
  }

  return spans;
}

/**
 * Parses a lesson body into blocks.
 *
 * Lines are joined until a blank line or a new construct, so a lead can wrap
 * their source at whatever width they like without it changing the page. That
 * includes list items, which is the case people actually hit: an item long
 * enough to wrap is exactly the item worth writing.
 */
export function parseLesson(body: string): readonly LessonBlock[] {
  const blocks: LessonBlock[] = [];
  let mode: "none" | "paragraph" | "list" | "quote" = "none";
  let paragraph: string[] = [];
  let items: string[][] = [];
  let quote: string[] = [];

  const flush = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", spans: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
    if (items.length > 0) {
      blocks.push({
        type: "list",
        items: items.map((item) => parseInline(item.join(" "))),
      });
      items = [];
    }
    if (quote.length > 0) {
      blocks.push({ type: "quote", spans: parseInline(quote.join(" ")) });
      quote = [];
    }
    mode = "none";
  };

  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();

    if (line.length === 0) {
      flush();
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: "heading",
        level: heading[1]?.length === 3 ? 3 : 2,
        spans: parseInline(heading[2] ?? ""),
      });
      continue;
    }

    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      if (mode !== "list") flush();
      items.push([item[1] ?? ""]);
      mode = "list";
      continue;
    }

    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      if (mode !== "quote") flush();
      quote.push(quoted[1] ?? "");
      mode = "quote";
      continue;
    }

    // A plain line continues whatever it is sitting inside, so a wrapped list
    // item stays one item rather than breaking into a stray paragraph.
    if (mode === "list") {
      items[items.length - 1]?.push(line);
    } else if (mode === "quote") {
      quote.push(line);
    } else {
      paragraph.push(line);
      mode = "paragraph";
    }
  }

  flush();
  return blocks;
}
