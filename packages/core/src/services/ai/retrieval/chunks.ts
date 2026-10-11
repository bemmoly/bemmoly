import { createHash } from 'node:crypto';
import type { RetrievalChunk, RetrievalDocument } from '../../../contracts/retrieval.ts';

/** Long enough to hold a section's point, short enough to cite precisely. */
export const MAX_CHUNK_CHARS = 1_600;

/** Splits text at paragraph, then sentence, then word boundaries into pieces of at most `max`. */
export function splitText(text: string, max = MAX_CHUNK_CHARS): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed ? [trimmed] : [];
  const pieces: string[] = [];
  let current = '';
  const units = trimmed.split(/(?<=\n)\s*\n|(?<=[.!?])\s+/).filter((unit) => unit.trim() !== '');
  for (const unit of units) {
    const next = current ? `${current} ${unit.trim()}` : unit.trim();
    if (next.length <= max) {
      current = next;
      continue;
    }
    if (current) pieces.push(current);
    let rest = unit.trim();
    while (rest.length > max) {
      const cut = rest.lastIndexOf(' ', max);
      const at = cut > max / 2 ? cut : max;
      pieces.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    current = rest;
  }
  if (current) pieces.push(current);
  return pieces;
}

/** A source's chunks with long ones split; each piece keeps its location and author. */
export function boundedChunks(chunks: readonly RetrievalChunk[]): RetrievalChunk[] {
  return chunks.flatMap((chunk) => splitText(chunk.text).map((text) => ({ ...chunk, text })));
}

/**
 * What is embedded for a chunk: the record's title and the location label lead, so a section
 * called "Rollback" in "RFC: Move sessions to Postgres" is found by either.
 */
export function embeddingInput(document: RetrievalDocument, chunk: RetrievalChunk): string {
  return `${document.title}\n${chunk.location.label}\n\n${chunk.text}`;
}

/** Stable per chunk content and place: the same hash means the stored vector still holds. */
export function contentHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
