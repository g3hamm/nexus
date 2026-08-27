/**
 * @nexus/knowledge — the apologetics knowledge base.
 *
 * Chunking that keeps arguments intact, embeddings behind a port, and
 * pgvector retrieval that returns fewer results rather than worse ones.
 */
export { chunkDocument, type ChunkingOptions, type TextChunk } from "./chunking.js";
export {
  VoyageEmbeddingProvider,
  HashingEmbeddingProvider,
  createEmbeddingProvider,
  DIMENSIONS,
  type EmbeddingConfig,
} from "./embeddings.js";
export { PgVectorKnowledgeBase, type PgVectorOptions } from "./store.js";
export { parseDocument } from "./load.js";
