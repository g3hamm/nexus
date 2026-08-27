import type { ChunkId, DocumentId } from "../domain/ids.js";
import type { LanguageCode } from "../domain/language.js";

/**
 * The apologetics knowledge base.
 *
 * This is what keeps the enablement sidebar from improvising theology. Every
 * substantive claim the sidebar offers a volunteer should be traceable to a
 * retrieved passage, and the UI shows that source, so a volunteer can judge
 * whether to trust it before putting it in front of a seeker.
 */

export type DocumentKind =
  | "apologetics"
  | "doctrine"
  | "objection_response"
  | "testimony"
  | "practical_guidance"
  | "cultural_context";

export interface KnowledgeDocument {
  readonly id: DocumentId;
  readonly title: string;
  readonly kind: DocumentKind;
  readonly language: LanguageCode;
  /** Where this came from — a book, an author, a ministry. Shown in citations. */
  readonly source: string;
  /** Doctrine profiles this document is appropriate for. Empty means "all". */
  readonly doctrineProfiles: readonly string[];
  readonly body: string;
  readonly updatedAt: Date;
}

export interface KnowledgeChunk {
  readonly id: ChunkId;
  readonly documentId: DocumentId;
  readonly title: string;
  readonly source: string;
  readonly kind: DocumentKind;
  readonly text: string;
  readonly language: LanguageCode;
}

export interface RetrievedChunk {
  readonly chunk: KnowledgeChunk;
  /** Cosine similarity, 0..1. Higher is closer. */
  readonly score: number;
}

export interface KnowledgeQuery {
  readonly text: string;
  readonly limit: number;
  /** Restrict to documents valid under this doctrine profile. */
  readonly doctrineProfile?: string;
  readonly kinds?: readonly DocumentKind[];
  /** Results below this score are dropped rather than padded out to `limit`. */
  readonly minScore?: number;
  readonly signal?: AbortSignal;
}

export interface KnowledgeBase {
  readonly name: string;
  search(query: KnowledgeQuery): Promise<readonly RetrievedChunk[]>;
  upsert(document: KnowledgeDocument): Promise<void>;
  remove(documentId: DocumentId): Promise<void>;
}

/** Turns text into vectors. Separate from the store so either can be swapped. */
export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: readonly string[], signal?: AbortSignal): Promise<readonly number[][]>;
}
