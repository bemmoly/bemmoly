import { Editor } from '@tiptap/core';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isEmptyDoc } from './doc.ts';
import { baseExtensions } from './schema/index.ts';
import { EVERY_NODE } from './testing/fixture.ts';
import { RichTextView } from './view.tsx';

afterEach(cleanup);

/** Elements and the attributes that carry meaning; classes and handlers are the view's own. */
function shape(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html;
  const keep = new Set([
    'href',
    'data-type',
    'data-checked',
    'data-id',
    'start',
    'type',
    'checked',
  ]);
  const walk = (element: Element) => {
    for (const attr of [...element.attributes]) {
      if (!keep.has(attr.name)) element.removeAttribute(attr.name);
      else if (attr.name === 'checked') element.setAttribute('checked', '');
    }
    [...element.children].forEach(walk);
  };
  [...root.children].forEach(walk);
  return root.innerHTML.replace(/<br>(?=<\/p>)/g, '');
}

describe('RichTextView', () => {
  it('prints the same elements the editor renders, so reading and editing look alike', () => {
    const editor = new Editor({ extensions: baseExtensions(), content: EVERY_NODE });
    const expected = shape(editor.getHTML());
    editor.destroy();
    const { container } = render(<RichTextView doc={EVERY_NODE} />);
    expect(shape(container.firstElementChild!.innerHTML)).toBe(expected);
  });

  it('keeps an empty paragraph one line tall, as the editor does', () => {
    const { container } = render(
      <RichTextView doc={{ type: 'doc', content: [{ type: 'paragraph' }] }} />,
    );
    expect(container.querySelector('p')?.innerHTML).toBe('<br>');
  });

  it('drops links that are not web, mail or in-app paths', () => {
    const doc = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bad',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
            {
              type: 'text',
              text: 'far',
              marks: [{ type: 'link', attrs: { href: '//evil.example' } }],
            },
          ],
        },
      ],
    };
    const { container } = render(<RichTextView doc={doc} />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('badfar');
  });

  it('hands link clicks to the host, so in-app paths move without a reload', () => {
    const navigate = vi.fn();
    const { getByText } = render(<RichTextView doc={EVERY_NODE} onNavigate={navigate} />);
    getByText('PLT-204').click();
    expect(navigate).toHaveBeenCalledWith('/work/issue/PLT-204', expect.anything());
  });

  it('prints nodes it does not know as their text', () => {
    const doc = {
      type: 'doc' as const,
      content: [{ type: 'issueEmbed', content: [{ type: 'text', text: 'PLT-9' }] }],
    };
    const { container } = render(<RichTextView doc={doc} />);
    expect(container.textContent).toBe('PLT-9');
  });
});

describe('isEmptyDoc', () => {
  it('sees text, mentions and dividers, and nothing else', () => {
    expect(isEmptyDoc(null)).toBe(true);
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
    expect(
      isEmptyDoc({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '  ' }] }],
      }),
    ).toBe(true);
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'horizontalRule' }] })).toBe(false);
    expect(isEmptyDoc(EVERY_NODE)).toBe(false);
  });
});
