import { editorSchema } from '@bemmoly/editor/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageEditor } from '../screen-context.ts';
import { TocList } from './toc-list.tsx';
import { readOutline } from './use-outline.ts';

const heading = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: text ? [{ type: 'text', text }] : [],
});
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

/** Just what the outline reads from an editor: the document and a DOM node per heading. */
function fakeEditor(content: object[]) {
  const doc = editorSchema().nodeFromJSON({ type: 'doc', content });
  const elements = new Map<number, HTMLElement>();
  const editor = {
    state: { doc },
    view: {
      nodeDOM: (pos: number) => {
        if (!elements.has(pos)) {
          const element = document.createElement('h2');
          element.scrollIntoView = vi.fn();
          elements.set(pos, element);
        }
        return elements.get(pos);
      },
    },
  };
  return { editor: editor as unknown as PageEditor, elements };
}

afterEach(cleanup);

describe('the outline', () => {
  const { editor } = fakeEditor([
    heading(1, 'Auth service RFC'),
    paragraph('Intro'),
    heading(2, 'Context'),
    heading(2, 'Rollback'),
    heading(3, 'Backfill'),
    heading(4, 'Too deep'),
    heading(2, ''),
    heading(2, 'Context'),
  ]);

  it('lists the top-level headings to level three, with the anchors the view prints', () => {
    expect(readOutline(editor).map(({ id, level, text }) => [id, level, text])).toEqual([
      ['auth-service-rfc', 1, 'Auth service RFC'],
      ['context', 2, 'Context'],
      ['rollback', 2, 'Rollback'],
      ['backfill', 3, 'Backfill'],
      ['context-2', 2, 'Context'],
    ]);
  });

  it('marks the heading being read and indents by level', () => {
    const outline = readOutline(editor);
    render(<TocList outline={outline} active="rollback" editor={editor} />);
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    expect(nav.textContent).toContain('On this page');
    const current = screen.getByRole('link', { name: 'Rollback' });
    expect(current.getAttribute('aria-current')).toBe('location');
    expect(screen.getByRole('link', { name: 'Backfill' }).className).toContain('pl-9');
    expect(screen.getByRole('link', { name: 'Auth service RFC' }).className).toContain('pl-3');
  });

  it('scrolls to a heading on a plain click and puts its anchor in the address', () => {
    const { editor: live, elements } = fakeEditor([heading(2, 'Context'), heading(2, 'Rollback')]);
    const outline = readOutline(live);
    const onJump = vi.fn();
    render(<TocList outline={outline} active={null} editor={live} onJump={onJump} />);
    fireEvent.click(screen.getByRole('link', { name: 'Rollback' }));
    const target = elements.get(outline[1]!.pos)!;
    expect(target.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
    expect(window.location.hash).toBe('#rollback');
    expect(onJump).toHaveBeenCalled();
  });

  it('draws nothing for a page without headings', () => {
    const { container } = render(<TocList outline={[]} active={null} editor={null} />);
    expect(container.textContent).toBe('');
  });
});
