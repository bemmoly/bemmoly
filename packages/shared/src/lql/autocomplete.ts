import { COMPARISON_OPERATORS, EMPTY_OPERATORS, LIST_OPERATORS, type Span } from './ast.ts';
import { readCursorContext, type CursorContext } from './autocomplete-state.ts';
import { DATE_FUNCTIONS, type LqlField, type LqlFieldCatalog } from './fields.ts';
import { formatName } from './format.ts';
import { tokenize, type Token } from './tokenizer.ts';

export interface LqlSuggestion {
  kind: 'field' | 'operator' | 'keyword' | 'value' | 'function' | 'punctuation';
  /** What goes into the query when the suggestion is picked. */
  text: string;
  /** What the list shows; differs from `text` for quoted names and labelled fields. */
  label: string;
  detail?: string;
}

export interface LqlCompletion {
  /** The text the chosen suggestion replaces: the word under the cursor, or nothing. */
  replace: Span;
  /** The partial text being completed, already stripped of quotes. */
  prefix: string;
  suggestions: LqlSuggestion[];
  /**
   * Set when the cursor is in a value position of a field whose values come
   * from the module (people, statuses, sprints). The filter bar asks that
   * provider for `prefix` and shows its answers after `suggestions`.
   */
  values?: { field: LqlField; provider: string };
}

/** Tokens a person types character by character, so the one under the cursor is still growing. */
const GROWING: ReadonlySet<Token['kind']> = new Set([
  'word',
  'keyword',
  'number',
  'date',
  'duration',
  'function',
]);

interface Prefix {
  tokens: Token[];
  prefix: string;
  replace: Span;
}

/**
 * Splits the text before the cursor into the finished tokens and the word
 * still being typed. An open quote counts as a word in progress: its content
 * is the prefix and the quote is replaced along with it. So does a lone `!`,
 * which is half of `!=` or `!~` rather than a mistake while it sits under the
 * cursor.
 */
function readPrefix(text: string, cursor: number): Prefix | undefined {
  const before = text.slice(0, cursor);
  const result = tokenize(before);
  if (!result.ok) {
    const error = result.error;
    const unfinished = before.slice(error.position);
    const quoted = unfinished.startsWith('"');
    if (!quoted && unfinished !== '!') return undefined;
    const finished = tokenize(before.slice(0, error.position));
    if (!finished.ok) return undefined;
    return {
      tokens: finished.value,
      prefix: quoted ? unfinished.slice(1) : unfinished,
      replace: { position: error.position, length: unfinished.length },
    };
  }
  const tokens = result.value;
  const last = tokens[tokens.length - 2];
  if (last && GROWING.has(last.kind) && last.span.position + last.span.length === cursor) {
    return { tokens: tokens.slice(0, -2), prefix: last.text, replace: last.span };
  }
  return { tokens, prefix: '', replace: { position: cursor, length: 0 } };
}

function keywords(...texts: string[]): LqlSuggestion[] {
  return texts.map((text) => ({ kind: 'keyword', text, label: text }));
}

function punctuation(...texts: string[]): LqlSuggestion[] {
  return texts.map((text) => ({ kind: 'punctuation', text, label: text }));
}

function fields(catalog: LqlFieldCatalog): LqlSuggestion[] {
  return catalog.fields.map((field) => ({
    kind: 'field',
    text: formatName(field.key),
    label: field.key,
    detail: field.label,
  }));
}

function operators(field: LqlField | undefined): LqlSuggestion[] {
  const allowed = field?.operators ?? [
    ...COMPARISON_OPERATORS,
    ...LIST_OPERATORS,
    ...EMPTY_OPERATORS,
  ];
  return allowed.map((operator) => ({ kind: 'operator', text: operator, label: operator }));
}

/** Values the catalog knows without asking the module: special words, functions and fixed options. */
function values(field: LqlField | undefined, context: CursorContext): LqlSuggestion[] {
  if (!field) return [];
  const out: LqlSuggestion[] = [];
  if (field.kind === 'user')
    out.push({ kind: 'value', text: 'me', label: 'me', detail: 'Signed-in person' });
  const functions = [...(field.functions ?? []), ...(field.kind === 'date' ? DATE_FUNCTIONS : [])];
  for (const name of functions)
    out.push({ kind: 'function', text: `${name}()`, label: `${name}()` });
  for (const option of field.options ?? []) {
    out.push({ kind: 'value', text: formatName(option), label: option });
  }
  const emptyAllowed = field.operators.includes('IS EMPTY');
  if (
    context.state === 'after-operator' &&
    emptyAllowed &&
    (context.operator === '=' || context.operator === '!=')
  ) {
    out.push({ kind: 'keyword', text: 'EMPTY', label: 'EMPTY', detail: 'No value' });
  }
  return out;
}

function suggestionsFor(
  context: CursorContext,
  field: LqlField | undefined,
  catalog: LqlFieldCatalog,
): LqlSuggestion[] {
  switch (context.state) {
    case 'expression':
      return [...fields(catalog), ...keywords('NOT'), ...punctuation('(')];
    case 'after-field':
      return operators(field);
    case 'after-operator':
    case 'in-list':
      return values(field, context);
    case 'after-is':
      return keywords('EMPTY', 'NOT EMPTY');
    case 'after-is-not':
      return keywords('EMPTY');
    case 'after-not-field':
      return keywords('IN');
    case 'after-in':
      return punctuation('(');
    case 'after-list-value':
      return punctuation(',', ')');
    case 'after-condition':
      return [...keywords('AND', 'OR', 'ORDER BY'), ...(context.depth > 0 ? punctuation(')') : [])];
    case 'after-order':
      return keywords('BY');
    case 'after-by':
      return fields(catalog);
    case 'after-order-field':
      return [...keywords('ASC', 'DESC'), ...punctuation(',')];
    case 'after-direction':
      return punctuation(',');
    case 'unknown':
      return [];
  }
}

function matches(suggestion: LqlSuggestion, prefix: string): boolean {
  const needle = prefix.toLowerCase();
  return (
    suggestion.label.toLowerCase().startsWith(needle) ||
    suggestion.text.toLowerCase().startsWith(needle) ||
    (suggestion.detail?.toLowerCase().startsWith(needle) ?? false)
  );
}

/**
 * Suggestions for the filter bar at a cursor position. Static suggestions are
 * returned directly; values that live in the module are described by the
 * field's provider name so the bar can fetch them.
 */
export function autocompleteLql(
  text: string,
  cursor: number,
  catalog: LqlFieldCatalog,
): LqlCompletion {
  const read = readPrefix(text, Math.max(0, Math.min(cursor, text.length)));
  if (!read) return { replace: { position: cursor, length: 0 }, prefix: '', suggestions: [] };
  const context = readCursorContext(read.tokens);
  const field = context.field === undefined ? undefined : catalog.resolve(context.field);
  const suggestions = suggestionsFor(context, field, catalog).filter((suggestion) =>
    matches(suggestion, read.prefix),
  );
  const completion: LqlCompletion = { replace: read.replace, prefix: read.prefix, suggestions };
  const wantsValues = context.state === 'after-operator' || context.state === 'in-list';
  if (wantsValues && field?.values !== undefined) {
    completion.values = { field, provider: field.values };
  }
  return completion;
}
