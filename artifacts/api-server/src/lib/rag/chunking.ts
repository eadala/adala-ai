/** Simple whitespace/paragraph chunker for the secure RAG foundation. */

export function chunkText(
  text: string,
  opts: { maxChars?: number; overlap?: number } = {},
): string[] {
  const maxChars = opts.maxChars ?? 800;
  const overlap = opts.overlap ?? 80;
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = "";
  };

  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length <= maxChars) {
      buf = buf ? `${buf}\n\n${p}` : p;
      continue;
    }
    if (buf) flush();
    if (p.length <= maxChars) {
      buf = p;
      continue;
    }
    // Hard-split long paragraphs
    let i = 0;
    while (i < p.length) {
      const end = Math.min(i + maxChars, p.length);
      chunks.push(p.slice(i, end).trim());
      if (end >= p.length) break;
      i = Math.max(end - overlap, i + 1);
    }
  }
  flush();
  return chunks.filter((c) => c.length > 0);
}
