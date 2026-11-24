import { createHash } from "node:crypto";
import { RAG_EMBEDDING_DIMS, type EmbeddingProvider } from "./types";

/**
 * Deterministic mock embedding provider for local/dev/tests.
 * Never calls external APIs. Output dimension is fixed to the schema contract (1536).
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dims = RAG_EMBEDDING_DIMS;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => hashEmbed(t, this.dims));
  }
}

export function assertEmbeddingDims(vec: number[], expected = RAG_EMBEDDING_DIMS): void {
  if (!Array.isArray(vec) || vec.length !== expected) {
    throw new Error(
      `RAG_EMBEDDING_DIM_MISMATCH: expected ${expected}, got ${Array.isArray(vec) ? vec.length : typeof vec}`,
    );
  }
}

function hashEmbed(text: string, dims: number): number[] {
  const out = new Array<number>(dims).fill(0);
  const normalized = text.normalize("NFKC").trim().toLowerCase();
  if (!normalized) return out;
  let counter = 0;
  while (counter * 32 < dims * 4) {
    const digest = createHash("sha256")
      .update(`${normalized}|${counter}`)
      .digest();
    for (let i = 0; i < digest.length && counter * 8 + i < dims; i++) {
      const idx = (counter * 8 + i) % dims;
      const byte = digest[i];
      if (byte === undefined) continue;
      out[idx] = (out[idx] ?? 0) + (byte / 255) * 2 - 1;
    }
    counter++;
  }
  let norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0));
  if (norm === 0) norm = 1;
  return out.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  assertEmbeddingDims(a);
  assertEmbeddingDims(b);
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    if (av === undefined || bv === undefined) continue;
    dot += av * bv;
  }
  return dot;
}
