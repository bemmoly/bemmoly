import type { AiCitation } from '@bemmoly/shared/ai-insights';

/**
 * Keeps only the citations the context offered. A model may invent "[c99]"; that id is
 * dropped, so the claim reads as unsourced instead of linking nowhere. A next step whose one
 * citation is invented is dropped whole: it has nothing to link to.
 */
export function keepKnownCitations<Output>(
  output: Output,
  offered: readonly AiCitation[],
): { output: Output; citations: AiCitation[] } {
  const known = new Map(offered.map((citation) => [citation.id, citation]));
  const used = new Set<string>();

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value
        .filter((item) => !isStep(item) || known.has(item.cite))
        .map((item) => walk(item));
    }
    if (value === null || typeof value !== 'object') return value;
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (key === 'cites' && Array.isArray(item)) {
        const kept = [...new Set(item.filter((id): id is string => known.has(String(id))))];
        for (const id of kept) used.add(id);
        return [key, kept];
      }
      if (key === 'cite' && typeof item === 'string' && known.has(item)) used.add(item);
      return [key, walk(item)];
    });
    return Object.fromEntries(entries);
  };

  const cleaned = walk(output) as Output;
  const citations = offered.filter((citation) => used.has(citation.id));
  return { output: cleaned, citations };
}

function isStep(value: unknown): value is { cite: string; label: string } {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { cite?: unknown }).cite === 'string' &&
    typeof (value as { label?: unknown }).label === 'string'
  );
}
