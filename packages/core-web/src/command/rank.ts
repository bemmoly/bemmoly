export interface CommandItem {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  /** Extra words that should match, e.g. "smtp" for the email settings page. */
  keywords?: readonly string[];
  href: string;
}

function subsequence(needle: string, haystack: string): boolean {
  let at = 0;
  for (const char of haystack) {
    if (char === needle[at]) at += 1;
    if (at === needle.length) return true;
  }
  return needle.length === 0;
}

/** Higher is better; 0 means no match. Prefix beats word prefix beats substring beats fuzzy. */
export function scoreItem(query: string, item: CommandItem): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const title = item.title.toLowerCase();
  const extra = [item.subtitle ?? '', ...(item.keywords ?? [])].join(' ').toLowerCase();
  if (title.startsWith(q)) return 100 - Math.min(title.length - q.length, 50) / 100;
  if (title.split(/\s+/).some((word) => word.startsWith(q))) return 80;
  if (title.includes(q)) return 60;
  if (extra.split(/\s+/).some((word) => word.startsWith(q))) return 50;
  if (extra.includes(q)) return 40;
  if (subsequence(q, title)) return 20;
  return 0;
}

/** Matching items, best first; ties keep their original order so groups stay stable. */
export function rankItems<T extends CommandItem>(query: string, items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index, score: scoreItem(query, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

export interface CommandGroup<T extends CommandItem> {
  name: string;
  items: T[];
}

/** Groups ranked items in the order each group first appears. */
export function groupItems<T extends CommandItem>(items: readonly T[]): CommandGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return [...groups].map(([name, list]) => ({ name, items: list }));
}
