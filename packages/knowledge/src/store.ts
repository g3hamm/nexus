import { and, cosineDistance, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type {
  DocumentId,
  EmbeddingProvider,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeQuery,
  RetrievedChunk,
} from "@nexus/core";
import { NexusError, asChunkId, asDocumentId } from "@nexus/core";
import type { NexusDatabase } from "@nexus/db";
import { schema } from "@nexus/db";
import { chunkDocument, type ChunkingOptions } from "./chunking.js";

const { knowledgeChunks, knowledgeDocuments } = schema;

export interface PgVectorOptions {
  readonly chunking?: ChunkingOptions;
  /** Results below this cosine similarity are dropped, never padded. */
  readonly defaultMinScore?: number;
}

/**
 * The apologetics knowledge base, over pgvector.
 *
 * The one rule worth stating up front: this returns fewer results rather than
 * worse ones. `minScore` is enforced and results are never padded out to
 * `limit`. The sidebar cites whatever it retrieves, and a confident citation
 * of an irrelevant passage is how a volunteer gets embarrassed in front of a
 * seeker — noticeably worse than the sidebar saying nothing.
 */
export class PgVectorKnowledgeBase implements KnowledgeBase {
  readonly name = "pgvector";
  readonly #db: NexusDatabase;
  readonly #embeddings: EmbeddingProvider;
  readonly #chunking: ChunkingOptions;
  readonly #defaultMinScore: number;

  constructor(
    db: NexusDatabase,
    embeddings: EmbeddingProvider,
    options: PgVectorOptions = {},
  ) {
    this.#db = db;
    this.#embeddings = embeddings;
    this.#chunking = options.chunking ?? {};
    this.#defaultMinScore = options.defaultMinScore ?? 0.35;
  }

  async search(query: KnowledgeQuery): Promise<readonly RetrievedChunk[]> {
    if (query.text.trim().length === 0) return [];

    const [embedding] = await this.#embeddings.embed([query.text], query.signal);
    if (!embedding) return [];

    // pgvector gives distance; similarity is what callers reason about.
    const similarity = sql<number>`1 - (${cosineDistance(knowledgeChunks.embedding, embedding)})`;
    const minScore = query.minScore ?? this.#defaultMinScore;

    const predicates = [gte(similarity, minScore)];
    if (query.kinds && query.kinds.length > 0) {
      predicates.push(inArray(knowledgeDocuments.kind, [...query.kinds]));
    }
    if (query.doctrineProfile) {
      // An empty profile list means the document is valid everywhere.
      predicates.push(
        sql`(
          cardinality(${knowledgeDocuments.doctrineProfiles}) = 0
          or ${query.doctrineProfile} = any(${knowledgeDocuments.doctrineProfiles})
        )`,
      );
    }

    const rows = await this.#db
      .select({
        id: knowledgeChunks.id,
        documentId: knowledgeChunks.documentId,
        text: knowledgeChunks.text,
        language: knowledgeChunks.language,
        title: knowledgeDocuments.title,
        source: knowledgeDocuments.source,
        kind: knowledgeDocuments.kind,
        score: similarity,
      })
      .from(knowledgeChunks)
      .innerJoin(
        knowledgeDocuments,
        eq(knowledgeChunks.documentId, knowledgeDocuments.id),
      )
      .where(and(...predicates))
      .orderBy(desc(similarity))
      .limit(query.limit);

    return rows.map((row) => ({
      chunk: {
        id: asChunkId(row.id),
        documentId: asDocumentId(row.documentId),
        title: row.title,
        source: row.source,
        kind: row.kind as RetrievedChunk["chunk"]["kind"],
        text: row.text,
        language: row.language,
      },
      score: row.score,
    }));
  }

  /**
   * Writes a document and replaces its chunks wholesale.
   *
   * Replacing rather than diffing: an edited paragraph shifts every subsequent
   * chunk boundary, so trying to update chunks in place produces a mixture of
   * old and new text that is worse than re-embedding.
   */
  async upsert(document: KnowledgeDocument): Promise<void> {
    const chunks = chunkDocument(
      { title: document.title, body: document.body },
      this.#chunking,
    );
    if (chunks.length === 0) {
      throw NexusError.validation(
        `Document "${document.title}" produced no chunks — is the body empty?`,
      );
    }

    const embeddings = await this.#embeddings.embed(chunks.map((c) => c.text));
    if (embeddings.length !== chunks.length) {
      throw new NexusError(
        "provider_unavailable",
        `Embedder returned ${embeddings.length} vectors for ${chunks.length} chunks`,
      );
    }

    await this.#db
      .insert(knowledgeDocuments)
      .values({
        id: document.id,
        title: document.title,
        kind: document.kind,
        language: document.language,
        source: document.source,
        doctrineProfiles: [...document.doctrineProfiles],
        body: document.body,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: knowledgeDocuments.id,
        set: {
          title: document.title,
          kind: document.kind,
          language: document.language,
          source: document.source,
          doctrineProfiles: [...document.doctrineProfiles],
          body: document.body,
          updatedAt: new Date(),
        },
      });

    await this.#db
      .delete(knowledgeChunks)
      .where(eq(knowledgeChunks.documentId, document.id));

    await this.#db.insert(knowledgeChunks).values(
      chunks.map((chunk, index) => ({
        documentId: document.id,
        text: chunk.text,
        language: document.language,
        ordinal: chunk.ordinal,
        embedding: embeddings[index] as number[],
      })),
    );
  }

  async remove(documentId: DocumentId): Promise<void> {
    // Chunks cascade from the document's foreign key.
    await this.#db
      .delete(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, documentId));
  }
}
