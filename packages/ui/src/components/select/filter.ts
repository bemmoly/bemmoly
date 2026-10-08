import type { SelectGroup, SelectOption } from './types.ts';

/** Lower case without accents, so "jose" finds "José" and "ANA" finds "Ana". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function matches(option: SelectOption, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  return (
    normalize(option.label).includes(q) ||
    (option.description !== undefined && normalize(option.description).includes(q))
  );
}

/** Flat options are one unlabelled group. */
export function toGroups(
  options: readonly SelectOption[] | undefined,
  groups: readonly SelectGroup[] | undefined,
): readonly SelectGroup[] {
  return groups ?? [{ label: '', options: options ?? [] }];
}

export interface ListSection {
  label: string;
  options: readonly SelectOption[];
}

export interface ListView {
  sections: readonly ListSection[];
  /** The drawn options in order; keyboard movement walks this. */
  flat: readonly SelectOption[];
  /** How many options match, drawn or not. */
  total: number;
  /** How many of the matches are drawn (the pinned option aside). */
  shown: number;
  /** The chosen option was added at the top although it does not match. */
  pinned: boolean;
}

/**
 * The options to draw: those matching `query`, at most `maxVisible` of them, group by group.
 * `pinned` (the chosen option) is drawn first when it would otherwise be left out, so the
 * current value is always in view.
 */
export function buildView(
  groups: readonly SelectGroup[],
  query: string,
  maxVisible: number,
  pinned?: SelectOption,
): ListView {
  let room = maxVisible;
  let total = 0;
  const sections: ListSection[] = [];
  for (const group of groups) {
    const found = group.options.filter((option) => matches(option, query));
    total += found.length;
    const drawn = found.slice(0, Math.max(room, 0));
    room -= drawn.length;
    if (drawn.length) sections.push({ label: group.label, options: drawn });
  }
  const flat = sections.flatMap((section) => section.options);
  const shown = flat.length;
  const pin = Boolean(pinned) && !flat.some((option) => option.value === pinned?.value);
  if (pin && pinned) {
    sections.unshift({ label: '', options: [pinned] });
    flat.unshift(pinned);
  }
  return { sections, flat, total, shown, pinned: pin };
}

/**
 * Type-ahead over a closed or open list: the next option after `from` whose label starts with
 * `typed`. Repeating one letter cycles through the options starting with it.
 */
export function typeahead(options: readonly SelectOption[], typed: string, from: number): number {
  const text = normalize(typed);
  const cycling = text.length > 1 && [...text].every((char) => char === text[0]);
  const prefix = cycling ? text[0]! : text;
  const start = cycling || text.length === 1 ? from + 1 : Math.max(from, 0);
  for (let step = 0; step < options.length; step += 1) {
    const index = (start + step) % options.length;
    const option = options[index]!;
    if (!option.disabled && normalize(option.label).startsWith(prefix)) return index;
  }
  return -1;
}
