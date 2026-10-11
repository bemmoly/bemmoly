import { describe, expect, it } from 'vitest';
import {
  bold,
  bullets,
  cell,
  doc,
  h,
  link,
  mention,
  p,
  PROSE,
  row,
  table,
  text,
} from './fixtures.ts';
import { diffDocs, diffInline, docDiffSchema, type BlockDiff } from './index.ts';

const ops = (blocks: readonly BlockDiff[]) => blocks.map((block) => block.op);
const [A, B, C, D, E] = PROSE.map((line) => p(line));

describe('diffDocs', () => {
  it('reads identical documents as all equal', () => {
    const result = diffDocs(doc(A!, B!, C!), doc(A!, B!, C!));
    expect(ops(result.blocks)).toEqual(['equal', 'equal', 'equal']);
    expect(result.stats).toEqual({ inserted: 0, deleted: 0, changed: 0, moved: 0 });
  });

  it('ignores key order inside the JSON', () => {
    const reordered = { content: [{ text: 'Hi', type: 'text' }], type: 'paragraph' };
    expect(ops(diffDocs(doc(p('Hi')), doc(reordered)).blocks)).toEqual(['equal']);
  });

  it('marks an inserted block where it now sits', () => {
    const result = diffDocs(doc(A!, C!), doc(A!, B!, C!));
    expect(ops(result.blocks)).toEqual(['equal', 'insert', 'equal']);
    expect(result.blocks[1]).toMatchObject({ op: 'insert', newIndex: 1, oldIndex: null, after: B });
    expect(result.stats.inserted).toBe(1);
  });

  it('marks a deleted block where it was', () => {
    const result = diffDocs(doc(A!, B!, C!), doc(A!, C!));
    expect(ops(result.blocks)).toEqual(['equal', 'delete', 'equal']);
    expect(result.blocks[1]).toMatchObject({ oldIndex: 1, newIndex: null, before: B });
    expect(result.stats.deleted).toBe(1);
  });

  it('shows a moved paragraph as moved, not deleted and inserted', () => {
    const result = diffDocs(doc(A!, B!, C!, D!, E!), doc(A!, C!, D!, B!, E!));
    expect(ops(result.blocks)).toEqual(['equal', 'move_source', 'equal', 'equal', 'move', 'equal']);
    expect(result.blocks[1]).toMatchObject({ op: 'move_source', oldIndex: 1, newIndex: 3 });
    expect(result.blocks[4]).toMatchObject({ op: 'move', oldIndex: 1, newIndex: 3, after: B });
    expect(result.stats).toEqual({ inserted: 0, deleted: 0, changed: 0, moved: 1 });
  });

  it('shows a moved and lightly edited paragraph as one move with its edits', () => {
    const edited = p(PROSE[1].replace('this quarter', 'this half'));
    const result = diffDocs(doc(A!, B!, C!, D!), doc(A!, C!, D!, edited));
    const moved = result.blocks.find((block) => block.op === 'move');
    expect(moved).toMatchObject({ oldIndex: 1, newIndex: 3 });
    expect(moved?.inline?.filter((part) => part.op !== 'equal')).toEqual([
      { op: 'delete', text: 'quarter', marks: [] },
      { op: 'insert', text: 'half', marks: [] },
    ]);
    expect(result.stats).toMatchObject({ moved: 1, inserted: 0, deleted: 0 });
  });

  it('marks an edited paragraph as changed with its word changes', () => {
    const result = diffDocs(
      doc(A!, p('The launch is on Monday.')),
      doc(A!, p('The launch is on Thursday.')),
    );
    expect(ops(result.blocks)).toEqual(['equal', 'change']);
    expect(result.blocks[1]!.inline).toEqual([
      { op: 'equal', text: 'The launch is on ', marks: [] },
      { op: 'delete', text: 'Monday', marks: [] },
      { op: 'insert', text: 'Thursday', marks: [] },
      { op: 'equal', text: '.', marks: [] },
    ]);
  });

  it('reports a mark change on unchanged words as formatting', () => {
    const result = diffDocs(
      doc(p('Read the runbook first')),
      doc(p(text('Read the '), text('runbook', [bold]), text(' first'))),
    );
    expect(result.blocks[0]!.inline).toEqual([
      { op: 'equal', text: 'Read the ', marks: [] },
      { op: 'format', text: 'runbook', marks: [bold], beforeMarks: [] },
      { op: 'equal', text: ' first', marks: [] },
    ]);
  });

  it('sees a changed link target as formatting', () => {
    const parts = diffInline(
      [text('docs', [link('https://a.example')])],
      [text('docs', [link('https://b.example')])],
    );
    expect(parts).toEqual([
      {
        op: 'format',
        text: 'docs',
        marks: [link('https://b.example')],
        beforeMarks: [link('https://a.example')],
      },
    ]);
  });

  it('treats inline nodes as single tokens', () => {
    const parts = diffInline(
      [text('Ask '), mention('u1', 'Ada'), text(' today')],
      [text('Ask '), mention('u2', 'Mo'), text(' today')],
    );
    expect(parts.map((part) => part.op)).toEqual(['equal', 'delete', 'insert', 'equal']);
    expect(parts[1]!.node).toMatchObject({ type: 'mention', attrs: { label: 'Ada' } });
  });

  it('records an attribute change such as a heading level', () => {
    const result = diffDocs(doc(h(2, 'Rollout plan')), doc(h(3, 'Rollout plan')));
    expect(result.blocks[0]).toMatchObject({
      op: 'change',
      attrs: { level: { before: 2, after: 3 } },
    });
    expect(result.blocks[0]!.inline?.every((part) => part.op === 'equal')).toBe(true);
  });

  it('replaces a rewritten paragraph rather than diffing unrelated words', () => {
    const result = diffDocs(doc(A!, p('Alpha beta gamma')), doc(A!, p('Something else')));
    expect(ops(result.blocks)).toEqual(['equal', 'delete', 'insert']);
  });

  it('diffs a table down to the cell that changed', () => {
    const before = table(
      row(cell('Owner', true), cell('Due', true)),
      row(cell('Ada'), cell('May')),
    );
    const after = table(
      row(cell('Owner', true), cell('Due', true)),
      row(cell('Ada'), cell('June')),
    );
    const result = diffDocs(doc(before), doc(after));
    expect(ops(result.blocks)).toEqual(['change']);
    const rows = result.blocks[0]!.children!;
    expect(ops(rows)).toEqual(['equal', 'change']);
    const cells = rows[1]!.children!;
    expect(ops(cells)).toEqual(['equal', 'change']);
    const paragraph = cells[1]!.children![0]!;
    expect(paragraph.inline).toEqual([
      { op: 'delete', text: 'May', marks: [] },
      { op: 'insert', text: 'June', marks: [] },
    ]);
  });

  it('diffs a table with a row added and a row removed', () => {
    const header = row(cell('Service', true), cell('Owner', true));
    const before = table(header, row(cell('api'), cell('Ada')), row(cell('web'), cell('Mo')));
    const after = table(header, row(cell('web'), cell('Mo')), row(cell('jobs'), cell('Vi')));
    const rows = diffDocs(doc(before), doc(after)).blocks[0]!.children!;
    expect(ops(rows)).toEqual(['equal', 'delete', 'equal', 'insert']);
  });

  it('diffs list items inside a changed list', () => {
    const result = diffDocs(
      doc(bullets('Draft', 'Review', 'Publish')),
      doc(bullets('Draft', 'Publish', 'Announce')),
    );
    expect(ops(result.blocks[0]!.children!)).toEqual(['equal', 'delete', 'equal', 'insert']);
  });

  it('compares against nothing as all inserted', () => {
    const result = diffDocs(null, doc(A!, B!));
    expect(ops(result.blocks)).toEqual(['insert', 'insert']);
    expect(result.stats.inserted).toBe(2);
  });

  it('keeps reading order when several kinds of change meet', () => {
    const result = diffDocs(doc(A!, B!, C!, D!), doc(D!, A!, p('New closing line'), C!));
    const placed = result.blocks.filter((b) => b.op !== 'move_source' && b.newIndex !== null);
    expect(placed.map((block) => block.newIndex)).toEqual([0, 1, 2, 3]);
    expect(result.stats).toMatchObject({ moved: 1, deleted: 1, inserted: 1 });
  });

  it('stays fast and complete on a long page', () => {
    const lines = Array.from({ length: 1500 }, (_, i) => p(`Line ${i} of the long page`));
    const edited = [...lines];
    edited.splice(700, 1, p('Line 700 of the long page, edited'));
    edited.push(lines[10]!);
    edited.splice(10, 1);
    const started = performance.now();
    const result = diffDocs(doc(...lines), doc(...edited));
    expect(performance.now() - started).toBeLessThan(2000);
    expect(result.stats).toMatchObject({ changed: 1, moved: 1, inserted: 0, deleted: 0 });
  });

  it('produces output the response schema accepts', () => {
    const result = diffDocs(doc(A!, B!), doc(B!, p('changed'), table(row(cell('x')))));
    expect(docDiffSchema.parse(result)).toEqual(result);
  });
});
