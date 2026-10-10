import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { diffDocs } from '../../../shared/diff/index.ts';
import {
  bold,
  bullets,
  cell,
  doc,
  h,
  p,
  PROSE,
  row,
  table,
  text,
} from '../../../shared/diff/fixtures.ts';
import { formatChange } from './diff-inline.tsx';
import { DiffView, foldRows } from './diff-view.tsx';

afterEach(cleanup);

const view = (before: ReturnType<typeof doc>, after: ReturnType<typeof doc>) => {
  const diff = diffDocs(before, after);
  const { container } = render(<DiffView diff={diff} />);
  return { diff, container };
};

const ops = (container: HTMLElement, op: string) =>
  [...container.querySelectorAll(`[data-op="${op}"]`)].map((el) => el.textContent?.trim());

describe('the compare renderer', () => {
  it('marks an inserted and a deleted block in their own colours', () => {
    const { container } = view(
      doc(p('Keep this.'), p('Drop this line.')),
      doc(p('Keep this.'), p('A brand new closing thought.')),
    );
    expect(ops(container, 'insert')).toEqual(['A brand new closing thought.']);
    expect(ops(container, 'delete')).toEqual(['Drop this line.']);
    expect(container.querySelector('[data-diff-row="insert"]')?.className).toContain(
      'before:bg-ok',
    );
    expect(container.querySelector('[data-diff-row="delete"]')?.className).toContain(
      'before:bg-danger',
    );
  });

  it('shows the words that changed inside an edited block', () => {
    const { container } = view(
      doc(p('Sessions stay valid for 15 minutes after cutover.')),
      doc(p('Sessions stay valid for 30 minutes after cutover.')),
    );
    expect(container.querySelector('[data-diff-row="change"]')).toBeTruthy();
    expect([...container.querySelectorAll('ins')].map((el) => el.textContent)).toEqual(['30']);
    expect([...container.querySelectorAll('del')].map((el) => el.textContent)).toEqual(['15']);
  });

  it('names a formatting change and keeps the text once', () => {
    const { container } = view(
      doc(p('Flip the flag off.')),
      doc(p('Flip the ', text('flag', [bold]), ' off.')),
    );
    const format = container.querySelector('[data-op="format"]');
    expect(format?.getAttribute('title')).toBe('Formatting: bold added');
    expect(format?.querySelector('strong')?.textContent).toBe('flag');
    expect(formatChange([bold], [])).toBe('bold removed');
  });

  it('draws a moved block at its new place, linked to the place it left', () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    const { container } = view(
      doc(p(PROSE[0]), p(PROSE[1]), p(PROSE[2]), p(PROSE[3])),
      doc(p(PROSE[1]), p(PROSE[2]), p(PROSE[3]), p(PROSE[0])),
    );
    const moved = container.querySelector('[data-op="move"]')!;
    const source = container.querySelector('[data-op="move_source"]')!;
    expect(moved.textContent).toContain(PROSE[0]);
    expect(source.textContent).toContain('Moved down');
    fireEvent.click(screen.getByRole('button', { name: /show where it went/ }));
    expect(scrolled).toHaveBeenCalled();
    expect(moved.hasAttribute('data-flash')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /show where it was/ }));
    expect(source.hasAttribute('data-flash')).toBe(true);
  });

  it('shows one edited table cell as that cell', () => {
    const { container } = view(
      doc(table(row(cell('Step', true), cell('When', true)), row(cell('Cutover'), cell('May')))),
      doc(table(row(cell('Step', true), cell('When', true)), row(cell('Cutover'), cell('June')))),
    );
    const cells = container.querySelectorAll('td[data-op="change"]');
    expect(cells).toHaveLength(1);
    expect(cells[0]?.querySelector('ins')?.textContent).toBe('June');
    expect(cells[0]?.querySelector('del')?.textContent).toBe('May');
    expect(container.querySelectorAll('th')).toHaveLength(2);
  });

  it('marks a list item added inside an unchanged list', () => {
    const { container } = view(
      doc(bullets('Dual-write', 'Switch reads')),
      doc(bullets('Dual-write', 'Switch reads', 'Remove the legacy cookie path')),
    );
    const added = container.querySelector('li[data-op="insert"]');
    expect(added?.textContent).toBe('Remove the legacy cookie path');
    expect(container.querySelectorAll('ul > li')).toHaveLength(3);
  });

  it('says when a heading changed level', () => {
    const { container } = view(doc(h(2, 'Rollback')), doc(h(3, 'Rollback')));
    expect(container.textContent).toContain('Heading · level: 2 → 3');
    expect(container.querySelector('h3')?.textContent).toBe('Rollback');
  });

  it('folds a long unchanged stretch and opens it on request', () => {
    const many = Array.from({ length: 8 }, (_, index) => p(`Unchanged paragraph ${index + 1}.`));
    const { diff, container } = view(doc(...many, p('Old end.')), doc(...many, p('New end.')));
    expect(foldRows(diff.blocks).some((rowEntry) => rowEntry.kind === 'fold')).toBe(true);
    const fold = screen.getByRole('button', { name: /7 unchanged blocks/ });
    expect(container.textContent).not.toContain('Unchanged paragraph 3.');
    fireEvent.click(fold);
    expect(container.textContent).toContain('Unchanged paragraph 3.');
  });

  it('says so when nothing changed', () => {
    view(doc(p('Same.')), doc(p('Same.')));
    expect(screen.getByText('No changes')).toBeTruthy();
  });
});
