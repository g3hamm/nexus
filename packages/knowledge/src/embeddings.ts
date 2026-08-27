import { createHash } from "node:crypto";
import type { EmbeddingProvider } from "@nexus/core";
import { NexusError } from "@nexus/core";

/** Must match `EMBEDDING_DIMENSIONS` in the schema — pgvector fixes the width. */
export const DIMENSIONS = 1024;

/**
 * Voyage AI embeddings.
 *
 * The Claude API has no embeddings endpoint, and Voyage is what Anthropic
 * points at. `voyage-3` is 1024-dimensional, which is why the pgvector column
 * is that width; changing model families is a migration, not a config change.
 */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly name = "voyage";
  readonly dimensions = DIMENSIONS;
  readonly #apiKey: string;
  readonly #model: string;

  constructor(apiKey: string, model = "voyage-3") {
    if (!apiKey) {
      throw new NexusError(
        "provider_unavailable",
        "VOYAGE_API_KEY is required for the Voyage embedding provider.",
      );
    }
    this.#apiKey = apiKey;
    this.#model = model;
  }

  async embed(
    texts: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify({ model: this.#model, input: [...texts] }),
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      throw new NexusError(
        "provider_unavailable",
        `Voyage embeddings failed with ${response.status}`,
      );
    }

    const body = (await response.json()) as {
      data?: { embedding: number[]; index: number }[];
    };
    if (!body.data) {
      throw new NexusError("provider_unavailable", "Voyage returned no embeddings");
    }

    // Results are not guaranteed to come back in request order.
    const ordered = [...body.data].sort((a, b) => a.index - b.index);
    return ordered.map((d) => d.embedding);
  }
}

/**
 * A local embedder that needs no API key and still retrieves sensibly.
 *
 * Feature hashing over word bigrams and unigrams, L2 normalised. It has no
 * semantic understanding — "scripture" and "the Bible" are unrelated to it —
 * but cosine similarity still tracks real lexical overlap, so retrieval in
 * development returns plausible results rather than noise. That difference
 * matters: a fake that returns random vectors makes the sidebar look broken
 * and teaches a developer nothing.
 *
 * Deterministic, so the same text always embeds identically and tests are
 * stable. Not for production — the factory refuses it there.
 */
export class HashingEmbeddingProvider implements EmbeddingProvider {
  readonly name = "hashing";
  readonly dimensions = DIMENSIONS;

  async embed(texts: readonly string[]): Promise<readonly number[][]> {
    return texts.map((text) => this.#embedOne(text));
  }

  #embedOne(text: string): number[] {
    const vector = new Array<number>(DIMENSIONS).fill(0);
    const tokens = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);

    const features = [...tokens];
    // Bigrams give word order a little weight, so "God loves you" and
    // "you love God" are not identical.
    for (let i = 0; i < tokens.length - 1; i++) {
      features.push(`${tokens[i]}_${tokens[i + 1]}`);
    }

    for (const feature of features) {
      const digest = createHash("sha1").update(feature).digest();
      const index = digest.readUInt32BE(0) % DIMENSIONS;
      // Sign from a second byte, so unrelated features cancel rather than
      // all pushing the vector the same way.
      const sign = (digest[4]! & 1) === 0 ? 1 : -1;
      vector[index] = (vector[index] ?? 0) + sign;
    }

    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vector;
    return vector.map((v) => v / norm);
  }
}

export interface EmbeddingConfig {
  readonly provider: string;
  readonly voyageApiKey?: string | undefined;
  readonly isProduction: boolean;
}

export function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProvider {
  switch (config.provider) {
    case "voyage":
      return new VoyageEmbeddingProvider(config.voyageApiKey ?? "");

    case "hashing":
      if (config.isProduction) {
        throw new NexusError(
          "provider_unavailable",
          "The hashing embedder has no semantic understanding and must not " +
            "back a production knowledge base. Set NEXUS_EMBEDDING_PROVIDER='voyage'.",
        );
      }
      return new HashingEmbeddingProvider();

    default:
      throw new NexusError(
        "provider_unavailable",
        `Unknown embedding provider "${config.provider}". Supported: voyage, hashing.`,
      );
  }
}
