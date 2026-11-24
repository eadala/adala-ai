import { cosineSimilarity } from "./embeddings";
import type { RagChunk, RagChunkStore, RagDocumentId, RagOfficeId } from "./types";

/** In-memory tenant-scoped store for unit tests and local prototypes. */
export class MemoryRagChunkStore implements RagChunkStore {
  private readonly byOffice = new Map<string, RagChunk[]>();

  async upsertChunks(chunks: RagChunk[]): Promise<void> {
    for (const c of chunks) {
      if (!c.officeId || c.officeId === "unknown" || c.officeId === "platform") {
        throw new Error("RAG_TENANT_REQUIRED");
      }
      const list = this.byOffice.get(c.officeId) ?? [];
      const next = list.filter(
        (x) => !(x.documentId === c.documentId && x.chunkIndex === c.chunkIndex),
      );
      next.push(c);
      this.byOffice.set(c.officeId, next);
    }
  }

  async deleteByDocument(officeId: RagOfficeId, documentId: RagDocumentId): Promise<void> {
    if (!officeId) throw new Error("RAG_TENANT_REQUIRED");
    const list = this.byOffice.get(officeId) ?? [];
    this.byOffice.set(
      officeId,
      list.filter((c) => c.documentId !== documentId),
    );
  }

  async search(
    officeId: RagOfficeId,
    queryEmbedding: number[],
    opts: { topK: number; documentIds?: RagDocumentId[] },
  ): Promise<RagChunk[]> {
    if (!officeId || officeId === "unknown" || officeId === "platform") {
      throw new Error("RAG_TENANT_REQUIRED");
    }
    let list = this.byOffice.get(officeId) ?? [];
    if (opts.documentIds?.length) {
      const allow = new Set(opts.documentIds);
      list = list.filter((c) => allow.has(c.documentId));
    }
    return list
      .map((c) => ({ c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, opts.topK))
      .map((x) => x.c);
  }
}
