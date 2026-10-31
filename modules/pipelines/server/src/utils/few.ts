/** "a, b, c and 4 more": a long list kept to one readable line. */
export function few(items: readonly string[], shown = 3): string {
  const head = items.slice(0, shown);
  const rest = items.length - head.length;
  if (rest > 0) return `${head.join(', ')} and ${rest} more`;
  return head.length > 1 ? `${head.slice(0, -1).join(', ')} and ${head.at(-1)}` : (head[0] ?? '');
}
