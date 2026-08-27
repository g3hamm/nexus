import { describe, expect, it } from "vitest";
import { chunkDocument } from "./chunking.js";
import { parseDocument } from "./load.js";
import {
  DIMENSIONS,
  HashingEmbeddingProvider,
  createEmbeddingProvider,
} from "./embeddings.js";

const cosine = (a: readonly number[], b: readonly number[]) =>
  a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);

describe("chunkDocument", () => {
  it("keeps a short document whole", () => {
    const chunks = chunkDocument({
      title: "Why suffering?",
      body: "Christians have never claimed suffering is easy to explain.",
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain("never claimed suffering is easy");
  });

  it("prefixes every chunk with the document and heading", () => {
    const chunks = chunkDocument({
      title: "The Resurrection",
      body: "## The empty tomb\n\nThe earliest sources agree the tomb was empty.",
    });

    expect(chunks[0]?.text.startsWith("The Resurrection — The empty tomb")).toBe(true);
  });

  it("splits on headings so separate arguments retrieve separately", () => {
    const chunks = chunkDocument({
      title: "Objections",
      body: [
        "## Suffering",
        "A good God would not permit gratuitous evil, the objection runs.",
        "",
        "## Hiddenness",
        "If God wanted to be known, the argument goes, he would be obvious.",
      ].join("\n"),
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.text).toContain("Suffering");
    expect(chunks[1]?.text).toContain("Hiddenness");
    expect(chunks[0]?.text).not.toContain("hiddenness");
  });

  it("keeps an objection and its answer in the same chunk", () => {
    // The motivating case: split these apart and the sidebar retrieves the
    // half that only restates the problem.
    const chunks = chunkDocument({
      title: "Suffering",
      body:
        "The objection is that a good God would prevent gratuitous evil.\n\n" +
        "The response is that freedom worth having entails the possibility of its misuse.",
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain("objection");
    expect(chunks[0]?.text).toContain("response");
  });

  it("splits an over-long paragraph on sentence boundaries", () => {
    const sentence = "This is a complete sentence about the resurrection. ";
    const chunks = chunkDocument(
      { title: "Long", body: sentence.repeat(40) },
      { maxChars: 400 },
    );

    expect(chunks.length).toBeGreaterThan(1);
    // Never mid-sentence.
    for (const chunk of chunks) {
      const body = chunk.text.split("\n\n").slice(1).join("\n\n");
      expect(body.trim()).toMatch(/\.$/);
    }
  });

  it("merges a trailing scrap rather than leaving it to retrieve alone", () => {
    const chunks = chunkDocument(
      {
        title: "Doc",
        body: `${"Substantial paragraph content here. ".repeat(20)}\n\nShort tail.`,
      },
      { maxChars: 500, minChars: 200 },
    );

    const last = chunks.at(-1)?.text ?? "";
    expect(last).toContain("Short tail.");
    // Glued to the paragraph before it, not standing on its own.
    expect(last).toContain("Substantial paragraph");
  });

  it("returns nothing for an empty body", () => {
    expect(chunkDocument({ title: "Empty", body: "   \n\n  " })).toHaveLength(0);
  });

  it("numbers chunks in document order", () => {
    const chunks = chunkDocument({
      title: "Doc",
      body: "## A\n\nFirst.\n\n## B\n\nSecond.\n\n## C\n\nThird.",
    });
    expect(chunks.map((c) => c.ordinal)).toEqual([0, 1, 2]);
  });
});

describe("HashingEmbeddingProvider", () => {
  const embedder = new HashingEmbeddingProvider();

  it("produces vectors of the width pgvector expects", async () => {
    const [vector] = await embedder.embed(["the grace of God"]);
    expect(vector).toHaveLength(DIMENSIONS);
  });

  it("is deterministic, so tests and dev runs are stable", async () => {
    const [a] = await embedder.embed(["the grace of God"]);
    const [b] = await embedder.embed(["the grace of God"]);
    expect(a).toEqual(b);
  });

  it("returns unit vectors, so cosine similarity is a dot product", async () => {
    const [vector] = await embedder.embed(["forgiveness and mercy"]);
    const norm = Math.sqrt((vector ?? []).reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("scores overlapping text above unrelated text", async () => {
    const [query, related, unrelated] = await embedder.embed([
      "how can I know God forgives me",
      "God forgives freely; you can know it because he promised",
      "the migration pattern of arctic terns across the pacific",
    ]);

    // Not semantic understanding — lexical overlap. Enough that retrieval in
    // development returns plausible results rather than noise.
    expect(cosine(query!, related!)).toBeGreaterThan(cosine(query!, unrelated!));
  });

  it("handles empty input without calling anything", async () => {
    expect(await embedder.embed([])).toEqual([]);
  });

  it("gives word order some weight", async () => {
    const [a, b] = await embedder.embed(["God loves you", "you love God"]);
    expect(a).not.toEqual(b);
  });
});

describe("createEmbeddingProvider", () => {
  it("refuses the hashing embedder in production", () => {
    expect(() =>
      createEmbeddingProvider({ provider: "hashing", isProduction: true }),
    ).toThrow(/no semantic understanding/);
  });

  it("allows it in development", () => {
    expect(
      createEmbeddingProvider({ provider: "hashing", isProduction: false }).name,
    ).toBe("hashing");
  });

  it("requires a key for Voyage", () => {
    expect(() =>
      createEmbeddingProvider({ provider: "voyage", isProduction: true }),
    ).toThrow(/VOYAGE_API_KEY/);
  });

  it("rejects an unknown provider by name", () => {
    expect(() =>
      createEmbeddingProvider({ provider: "word2vec", isProduction: false }),
    ).toThrow(/Unknown embedding provider/);
  });
});

describe("parseDocument", () => {
  const valid = [
    "---",
    "kind: objection_response",
    "source: Some Author, Some Book",
    "language: en",
    "doctrineProfiles: ecumenical-creedal, reformed",
    "---",
    "# Why does God allow suffering?",
    "",
    "Body text here.",
  ].join("\n");

  it("reads the header and body", () => {
    const doc = parseDocument(valid, "suffering.md");
    expect(doc.title).toBe("Why does God allow suffering?");
    expect(doc.kind).toBe("objection_response");
    expect(doc.source).toBe("Some Author, Some Book");
    expect(doc.doctrineProfiles).toEqual(["ecumenical-creedal", "reformed"]);
    expect(doc.body).toContain("Body text here.");
  });

  it("requires a source, because volunteers are shown it", () => {
    const noSource = valid.replace("source: Some Author, Some Book\n", "");
    expect(() => parseDocument(noSource, "x.md")).toThrow(/needs a "source"/);
  });

  it("rejects an unknown kind rather than silently defaulting", () => {
    const bad = valid.replace("objection_response", "hot_take");
    expect(() => parseDocument(bad, "x.md")).toThrow(/unknown kind/);
  });

  it("requires a header block", () => {
    expect(() => parseDocument("# Just a heading", "x.md")).toThrow(/--- header/);
  });

  it("treats an empty doctrineProfiles as valid everywhere", () => {
    const anyProfile = valid.replace(
      "doctrineProfiles: ecumenical-creedal, reformed",
      "doctrineProfiles:",
    );
    expect(parseDocument(anyProfile, "x.md").doctrineProfiles).toEqual([]);
  });

  it("defaults language to English when unstated", () => {
    const noLang = valid.replace("language: en\n", "");
    expect(parseDocument(noLang, "x.md").language).toBe("en");
  });
});

describe("the starter corpus", () => {
  const dir = new URL("../../../content/knowledge/", import.meta.url);

  it("every shipped document parses and chunks", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = fileURLToPath(dir);

    const files = readdirSync(path).filter((f) => f.endsWith(".md") && f !== "README.md");
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const parsed = parseDocument(readFileSync(`${path}${file}`, "utf8"), file);
      const chunks = chunkDocument({ title: parsed.title, body: parsed.body });

      expect(chunks.length, `${file} should chunk`).toBeGreaterThan(0);
      // Every chunk carries its breadcrumb, which is what makes retrieval work.
      for (const chunk of chunks) {
        expect(chunk.text.startsWith(parsed.title)).toBe(true);
      }
    }
  });
});
