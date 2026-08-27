/**
 * Splitting documents for retrieval.
 *
 * Fixed-size character chunking is the obvious approach and the wrong one
 * here. An apologetics answer cut in half retrieves as two fragments, neither
 * of which answers anything — the objection lands in one chunk and the
 * response in another, and the sidebar cites the half that only restates the
 * problem.
 *
 * So: split on structure first (headings, then paragraphs), accumulate up to a
 * size bound, and only fall back to sentence splitting when a single paragraph
 * is genuinely too long. Every chunk carries a breadcrumb of the document
 * title and the heading it came from, which materially improves retrieval —
 * an embedded chunk that says only "This is answered in three ways" is
 * useless without knowing what "this" was.
 */

export interface ChunkingOptions {
  /** Soft ceiling. A chunk may exceed it only when one sentence does. */
  readonly maxChars?: number;
  /** Chunks below this merge forward rather than standing alone. */
  readonly minChars?: number;
}

export interface TextChunk {
  readonly text: string;
  readonly ordinal: number;
}

const DEFAULTS = { maxChars: 1200, minChars: 200 };

export function chunkDocument(
  document: { readonly title: string; readonly body: string },
  options: ChunkingOptions = {},
): readonly TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULTS.maxChars;
  const minChars = options.minChars ?? DEFAULTS.minChars;

  const sections = splitIntoSections(document.body);
  const chunks: string[] = [];

  for (const section of sections) {
    const breadcrumb = section.heading
      ? `${document.title} — ${section.heading}`
      : document.title;

    const pieces = packParagraphs(section.paragraphs, maxChars, minChars, breadcrumb);
    chunks.push(...pieces);
  }

  return chunks
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text, ordinal) => ({ text, ordinal }));
}

interface Section {
  readonly heading: string | null;
  readonly paragraphs: readonly string[];
}

/** Splits on markdown headings, keeping the heading with its content. */
function splitIntoSections(body: string): readonly Section[] {
  const lines = body.split(/\r?\n/);
  const sections: Section[] = [];

  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text.length > 0) {
      sections.push({ heading, paragraphs: splitIntoParagraphs(text) });
    }
    buffer = [];
  };

  for (const line of lines) {
    const match = /^#{1,6}\s+(.*)$/.exec(line.trim());
    if (match) {
      flush();
      heading = match[1]?.trim() ?? null;
    } else {
      buffer.push(line);
    }
  }
  flush();

  // A document with no headings at all is still one section.
  if (sections.length === 0) {
    const paragraphs = splitIntoParagraphs(body);
    if (paragraphs.length > 0) sections.push({ heading: null, paragraphs });
  }

  return sections;
}

function splitIntoParagraphs(text: string): readonly string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

/** Accumulates paragraphs into chunks, keeping whole thoughts together. */
function packParagraphs(
  paragraphs: readonly string[],
  maxChars: number,
  minChars: number,
  breadcrumb: string,
): string[] {
  const prefix = `${breadcrumb}\n\n`;
  const budget = Math.max(maxChars - prefix.length, 200);

  const out: string[] = [];
  let current = "";

  const emit = () => {
    if (current.trim().length > 0) out.push(prefix + current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    // One paragraph longer than the whole budget: split it on sentences,
    // which is the last boundary that preserves meaning.
    if (paragraph.length > budget) {
      emit();
      for (const piece of splitLongParagraph(paragraph, budget)) {
        out.push(prefix + piece);
      }
      continue;
    }

    const candidate = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
    if (candidate.length > budget) {
      emit();
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  emit();

  // A trailing scrap is glued to its predecessor rather than left to retrieve
  // on its own, where it would carry no argument.
  if (out.length >= 2) {
    const last = out[out.length - 1]!;
    if (last.length - prefix.length < minChars) {
      const previous = out[out.length - 2]!;
      const merged = `${previous}\n\n${last.slice(prefix.length)}`;
      out.splice(out.length - 2, 2, merged);
    }
  }

  return out;
}

function splitLongParagraph(paragraph: string, budget: number): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [paragraph];
  const out: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current + sentence;
    if (candidate.length > budget && current.length > 0) {
      out.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim().length > 0) out.push(current.trim());
  return out;
}
