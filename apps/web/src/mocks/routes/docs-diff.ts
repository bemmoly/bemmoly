/*
 * A small structural diff for the dev mock's version compare, in the Docs server's response
 * shape (blocks with equal, insert, delete, change, move and move_source; inline runs; nested
 * children for lists and tables). Apps never import a module, so this is not the server's
 * diff: it pairs blocks more simply, which is enough to drive every state of the compare view.
 */

export interface PmNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: PmNode[];
}

interface InlinePart {
  op: 'equal' | 'insert' | 'delete' | 'format';
  text?: string;
  node?: PmNode;
  marks: PmNode['marks'] & object;
  beforeMarks?: PmNode['marks'];
}

export interface BlockDiff {
  op: 'equal' | 'insert' | 'delete' | 'change' | 'move' | 'move_source';
  type: string;
  oldIndex: number | null;
  newIndex: number | null;
  before?: PmNode;
  after?: PmNode;
  attrs?: Record<string, { before: unknown; after: unknown }>;
  inline?: InlinePart[];
  children?: BlockDiff[];
}

const key = (node: PmNode) => JSON.stringify(node);
const isInline = (nodes: PmNode[] = []) =>
  nodes.every((node) => node.text !== undefined || !node.content);

/** Longest common subsequence of two key lists, as index pairs. */
function lcs<T>(a: readonly T[], b: readonly T[]): [number, number][] {
  const table = a.map(() => new Array<number>(b.length + 1).fill(0));
  table.push(new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) i += 1;
    else j += 1;
  }
  return pairs;
}

interface Token {
  text?: string;
  node?: PmNode;
  marks: NonNullable<PmNode['marks']>;
}

function tokens(nodes: PmNode[] = []): Token[] {
  return nodes.flatMap((node): Token[] =>
    node.text !== undefined
      ? (node.text.match(/\s+|[^\s]+/g) ?? []).map((text) => ({ text, marks: node.marks ?? [] }))
      : [
          {
            node: { type: node.type, ...(node.attrs ? { attrs: node.attrs } : {}) },
            marks: node.marks ?? [],
          },
        ],
  );
}

const plain = (token: Token) => token.text ?? JSON.stringify(token.node);

function diffInline(before: PmNode[] = [], after: PmNode[] = []): InlinePart[] {
  const a = tokens(before);
  const b = tokens(after);
  const pairs = lcs(a.map(plain), b.map(plain));
  const parts: InlinePart[] = [];
  const push = (op: InlinePart['op'], token: Token, was?: Token) => {
    const part: InlinePart = {
      op,
      marks: token.marks,
      ...(token.text !== undefined ? { text: token.text } : { node: token.node! }),
    };
    if (was) part.beforeMarks = was.marks;
    const last = parts.at(-1);
    if (
      last &&
      last.op === op &&
      last.text !== undefined &&
      part.text !== undefined &&
      JSON.stringify(last.marks) === JSON.stringify(part.marks) &&
      !was
    ) {
      last.text += part.text;
    } else parts.push(part);
  };
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    while (i < pi) push('delete', a[i++]!);
    while (j < pj) push('insert', b[j++]!);
    if (pi < a.length) {
      const same = JSON.stringify(a[pi]!.marks) === JSON.stringify(b[pj]!.marks);
      if (same) push('equal', b[pj]!);
      else push('format', b[pj]!, a[pi]);
      i += 1;
      j += 1;
    }
  }
  return parts;
}

function attrChanges(before: PmNode, after: PmNode) {
  const names = new Set([...Object.keys(before.attrs ?? {}), ...Object.keys(after.attrs ?? {})]);
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const name of names) {
    const was = before.attrs?.[name];
    const now = after.attrs?.[name];
    if (JSON.stringify(was) !== JSON.stringify(now))
      changes[name] = { before: was ?? null, after: now ?? null };
  }
  return Object.keys(changes).length ? changes : undefined;
}

function changed(before: PmNode, after: PmNode, oldIndex: number, newIndex: number): BlockDiff {
  const entry: BlockDiff = { op: 'change', type: after.type, oldIndex, newIndex, before, after };
  const attrs = attrChanges(before, after);
  if (attrs) entry.attrs = attrs;
  if (isInline(before.content) && isInline(after.content))
    entry.inline = diffInline(before.content, after.content);
  else entry.children = diffBlocks(before.content ?? [], after.content ?? []);
  return entry;
}

/** One level of blocks: LCS for equal ones, then moves, same-type neighbours as changes. */
export function diffBlocks(before: PmNode[], after: PmNode[]): BlockDiff[] {
  const a = before.map(key);
  const b = after.map(key);
  const pairs = lcs(a, b);
  const out: BlockDiff[] = [];
  const usedOld = new Set(pairs.map(([i]) => i));
  const usedNew = new Set(pairs.map(([, j]) => j));
  const movedTo = new Map<number, number>();
  b.forEach((value, j) => {
    if (usedNew.has(j)) return;
    const i = a.findIndex(
      (other, index) => other === value && !usedOld.has(index) && !movedTo.has(index),
    );
    if (i >= 0) movedTo.set(i, j);
  });
  const movedFrom = new Map([...movedTo].map(([i, j]) => [j, i]));
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    while (i < pi || j < pj) {
      const oldFree = i < pi && !movedTo.has(i);
      const newFree = j < pj && !movedFrom.has(j);
      if (oldFree && newFree && before[i]!.type === after[j]!.type) {
        out.push(changed(before[i]!, after[j]!, i, j));
        i += 1;
        j += 1;
      } else if (i < pi) {
        const to = movedTo.get(i);
        out.push(
          to === undefined
            ? {
                op: 'delete',
                type: before[i]!.type,
                oldIndex: i,
                newIndex: null,
                before: before[i]!,
              }
            : {
                op: 'move_source',
                type: before[i]!.type,
                oldIndex: i,
                newIndex: to,
                before: before[i]!,
              },
        );
        i += 1;
      } else {
        const from = movedFrom.get(j);
        out.push(
          from === undefined
            ? { op: 'insert', type: after[j]!.type, oldIndex: null, newIndex: j, after: after[j]! }
            : { op: 'move', type: after[j]!.type, oldIndex: from, newIndex: j, after: after[j]! },
        );
        j += 1;
      }
    }
    if (pi < a.length) {
      out.push({
        op: 'equal',
        type: after[pj]!.type,
        oldIndex: pi,
        newIndex: pj,
        after: after[pj]!,
      });
      i += 1;
      j += 1;
    }
  }
  return out;
}

export function diffDocs(before: PmNode | null | undefined, after: PmNode | null | undefined) {
  const blocks = diffBlocks(before?.content ?? [], after?.content ?? []);
  const count = (op: BlockDiff['op']) => blocks.filter((block) => block.op === op).length;
  return {
    blocks,
    stats: {
      inserted: count('insert'),
      deleted: count('delete'),
      changed: count('change'),
      moved: count('move'),
    },
  };
}
