/** Secure RAG foundation types — tenant isolation is mandatory. */

export const RAG_EMBEDDING_DIMS = 1536 as const;

export type RagOfficeId = string;
export type RagDocumentId = string;

export interface RagChunk {
  id: string;
  officeId: RagOfficeId;
  documentId: RagDocumentId;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface RagEvidenceHit {
  officeId: RagOfficeId;
  documentId: RagDocumentId;
  chunkIndex: number;
  content: string;
  score: number;
  /** Caller must treat this as untrusted retrieved evidence, not model analysis. */
  evidenceKind: "retrieved_chunk";
  /** Injection-hardening wrapper for prompt assembly. */
  promptSafeContent: string;
}

export interface EmbeddingProvider {
  readonly dims: typeof RAG_EMBEDDING_DIMS;
  embed(texts: string[]): Promise<number[][]>;
}

export interface RagChunkStore {
  upsertChunks(chunks: RagChunk[]): Promise<void>;
  deleteByDocument(officeId: RagOfficeId, documentId: RagDocumentId): Promise<void>;
  search(
    officeId: RagOfficeId,
    queryEmbedding: number[],
    opts: { topK: number; documentIds?: RagDocumentId[] },
  ): Promise<RagChunk[]>;
}
