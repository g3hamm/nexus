/**
 * @nexus/knowledge — the apologetics knowledge base.
 *
 * SCAFFOLD. The contracts and the schema are settled; retrieval is wave two.
 *
 * The storage side already exists: `knowledge_documents` and
 * `knowledge_chunks` are in the schema in @nexus/db, with an HNSW index over
 * cosine distance and a fixed 1024-dimension embedding column.
 *
 * What is left:
 *
 *   - Chunking. Split on semantic boundaries (headings, arguments), not fixed
 *     character counts — an apologetics answer cut in half retrieves as two
 *     useless fragments.
 *   - An `EmbeddingProvider`. The Claude API has no embeddings endpoint;
 *     Voyage AI is what Anthropic points at, and 1024 dimensions matches its
 *     voyage-3 family. Changing that width is a migration, not a config
 *     change, because pgvector fixes the column.
 *   - Retrieval, with `minScore` enforced. Returning weak matches to pad out
 *     `limit` is worse than returning fewer: the sidebar cites what it
 *     retrieves, and a confident citation of an irrelevant passage is exactly
 *     how a volunteer gets embarrassed in front of a seeker.
 *   - Doctrine filtering, so a deployment with a narrower confession only ever
 *     retrieves documents valid under its profile.
 */
import type {
  DocumentId,
  EmbeddingProvider,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeQuery,
  RetrievedChunk,
} from "@nexus/core";
import { NexusError } from "@nexus/core";

export class PgVectorKnowledgeBase implements KnowledgeBase {
  readonly name = "pgvector";

  async search(_query: KnowledgeQuery): Promise<readonly RetrievedChunk[]> {
    throw NexusError.notImplemented("PgVectorKnowledgeBase.search");
  }

  async upsert(_document: KnowledgeDocument): Promise<void> {
    throw NexusError.notImplemented("PgVectorKnowledgeBase.upsert");
  }

  async remove(_documentId: DocumentId): Promise<void> {
    throw NexusError.notImplemented("PgVectorKnowledgeBase.remove");
  }
}

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly name = "voyage";
  readonly dimensions = 1024;

  async embed(
    _texts: readonly string[],
    _signal?: AbortSignal,
  ): Promise<readonly number[][]> {
    throw NexusError.notImplemented("VoyageEmbeddingProvider.embed");
  }
}
