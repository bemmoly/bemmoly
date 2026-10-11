import {
  autocompleteLql,
  createIssueFieldCatalog,
  formatName,
  parseLql,
  validateLql,
  type LqlError,
  type LqlSuggestion,
} from '@bemmoly/shared';

/*
 * The filter bar's language support, pure: parse and validate against the issue field
 * catalog, and complete at the cursor, answering the value providers (people, statuses,
 * types, labels, epics, sprints) from what the board has already loaded.
 */

const catalog = createIssueFieldCatalog();

/** Names per provider, as `autocompleteLql` names them; each list is what the bar may offer. */
export type LqlValueSources = Partial<Record<string, readonly string[]>>;

const MAX_SUGGESTIONS = 12;

/** The first problem in a query, or null when it is empty or valid. */
export function checkLql(text: string): LqlError | null {
  if (text.trim() === '') return null;
  const parsed = parseLql(text);
  if (!parsed.ok) return parsed.error;
  return validateLql(parsed.value, catalog)[0] ?? null;
}

export interface LqlCompletionList {
  /** Where the picked suggestion goes: replaces `length` characters from `position`. */
  position: number;
  length: number;
  items: LqlSuggestion[];
}

export function completeLql(
  text: string,
  cursor: number,
  sources: LqlValueSources,
): LqlCompletionList {
  const completion = autocompleteLql(text, cursor, catalog);
  const items = [...completion.suggestions];
  if (completion.values) {
    const needle = completion.prefix.toLowerCase();
    for (const name of sources[completion.values.provider] ?? []) {
      if (name.toLowerCase().startsWith(needle)) {
        items.push({ kind: 'value', text: formatName(name), label: name });
      }
    }
  }
  return {
    position: completion.replace.position,
    length: completion.replace.length,
    items: items.slice(0, MAX_SUGGESTIONS),
  };
}

/** The text with a suggestion put in, and where the cursor goes after it. */
export function insertSuggestion(
  text: string,
  list: Pick<LqlCompletionList, 'position' | 'length'>,
  suggestion: LqlSuggestion,
): { text: string; cursor: number } {
  const head = text.slice(0, list.position);
  const tail = text.slice(list.position + list.length);
  const spacer = tail.startsWith(' ') || suggestion.text.endsWith('(') ? '' : ' ';
  const next = `${head}${suggestion.text}${spacer}${tail}`;
  return { text: next, cursor: head.length + suggestion.text.length + spacer.length };
}
