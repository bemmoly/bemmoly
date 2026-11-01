/*
 * A small HCL writer whose output is already in `terraform fmt` form: two-space indents, and
 * the equals signs of consecutive one-line attributes aligned. An attribute whose value spans
 * lines (an object) breaks the run, as fmt does, and so do blocks, comments and blank lines.
 */

/** An expression as written: a quoted string, a reference, a number, a one-line list. */
export type Expr = string;

export interface HclObject {
  object: ReadonlyArray<readonly [string, Value]>;
}

export type Value = Expr | HclObject;

export type Item =
  | { attr: string; value: Value }
  | { block: string; labels?: readonly string[]; body: readonly Item[] }
  | { comment: string }
  | { blank: true };

/** A quoted HCL string; `${` and `%{` would start a template, so they are escaped. */
export function str(value: string): Expr {
  return JSON.stringify(value).replace(/\$\{/g, '$${').replace(/%\{/g, '%%{');
}

/** A quoted string with `${…}` references kept: parts alternate text and expressions. */
export function interpolate(parts: readonly (string | { ref: string })[]): Expr {
  const [only] = parts;
  if (parts.length === 1 && only !== undefined && typeof only !== 'string') return only.ref;
  const inner = parts
    .map((part) => (typeof part === 'string' ? str(part).slice(1, -1) : `\${${part.ref}}`))
    .join('');
  return `"${inner}"`;
}

export const list = (items: readonly Expr[]): Expr => `[${items.join(', ')}]`;

export const num = (value: number): Expr => String(value);

export const bool = (value: boolean): Expr => (value ? 'true' : 'false');

/** Object keys that HCL reads bare; anything else is quoted. */
const keyOf = (key: string) => (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : str(key));

export const object = (entries: Readonly<Record<string, Value>>): HclObject => ({
  object: Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)),
});

export const attr = (name: string, value: Value): Item => ({ attr: name, value });

export const block = (name: string, labels: readonly string[], body: readonly Item[]): Item => ({
  block: name,
  labels,
  body,
});

export const comment = (text: string): Item => ({ comment: text });

export const blank: Item = { blank: true };

const isObject = (value: Value): value is HclObject => typeof value !== 'string';

/** Lines of `entries` at `indent`, one-line runs aligned on their equals signs. */
function aligned(
  entries: ReadonlyArray<readonly [string, Value]>,
  indent: string,
  renderNested: (value: HclObject, indent: string) => string[],
): string[] {
  const lines: string[] = [];
  let run: Array<readonly [string, Expr]> = [];
  const flush = () => {
    const width = Math.max(0, ...run.map(([key]) => key.length));
    for (const [key, value] of run) lines.push(`${indent}${key.padEnd(width)} = ${value}`);
    run = [];
  };
  for (const [key, value] of entries) {
    if (isObject(value)) {
      flush();
      const nested = renderNested(value, indent);
      lines.push(`${indent}${key} = ${nested[0] ?? '{}'}`, ...nested.slice(1));
    } else run.push([key, value]);
  }
  flush();
  return lines;
}

function renderObject(value: HclObject, indent: string): string[] {
  if (value.object.length === 0) return ['{}'];
  const inner = aligned(
    value.object.map(([key, entry]) => [keyOf(key), entry] as const),
    `${indent}  `,
    renderObject,
  );
  return ['{', ...inner, `${indent}}`];
}

function renderItems(items: readonly Item[], indent: string): string[] {
  const lines: string[] = [];
  let run: Array<readonly [string, Value]> = [];
  const flush = () => {
    lines.push(...aligned(run, indent, renderObject));
    run = [];
  };
  for (const item of items) {
    if ('attr' in item) {
      run.push([item.attr, item.value]);
      continue;
    }
    flush();
    if ('blank' in item) lines.push('');
    else if ('comment' in item) {
      for (const line of item.comment.split('\n')) lines.push(`${indent}# ${line}`.trimEnd());
    } else {
      const head = [item.block, ...(item.labels ?? []).map(str)].join(' ');
      if (item.body.length === 0) lines.push(`${indent}${head} {}`);
      else lines.push(`${indent}${head} {`, ...renderItems(item.body, `${indent}  `), `${indent}}`);
    }
  }
  flush();
  return lines;
}

/** A whole file: top-level items, separated as given, ending in one newline. */
export function render(items: readonly Item[]): string {
  return `${renderItems(items, '').join('\n')}\n`;
}

/** Top-level blocks with one blank line between each. */
export function spaced(groups: ReadonlyArray<readonly Item[]>): Item[] {
  return groups
    .filter((group) => group.length > 0)
    .flatMap((group, i) => (i ? [blank, ...group] : [...group]));
}

/** "acme-commerce-prod" as a Terraform name: acme_commerce_prod. */
export function nameOf(value: string): string {
  const name = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z_]/.test(name) ? name : `n_${name}`;
}
