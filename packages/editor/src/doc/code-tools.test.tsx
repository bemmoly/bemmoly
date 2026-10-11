import type { Editor } from '@tiptap/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RichTextDoc } from '../types.ts';
import DocEditor from './doc-editor.tsx';

afterEach(cleanup);

const DOC: RichTextDoc = {
  type: 'doc',
  content: [
    {
      type: 'codeBlock',
      attrs: { language: 'go' },
      content: [{ type: 'text', text: 'const ttl = 30' }],
    },
  ],
};

async function setup(editable = true) {
  render(<DocEditor label="Page body" initialDoc={DOC} editable={editable} />);
  const box = await screen.findByRole('textbox', { name: 'Page body' });
  return (box as HTMLElement & { editor: Editor }).editor;
}

describe('code block tools', () => {
  it('changes the language from the picker', async () => {
    const editor = await setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Language, Go' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Python' }));
    await waitFor(() => expect(editor.getJSON().content?.[0]?.attrs?.['language']).toBe('python'));
  });

  it('shows the language without a picker when read-only, and Copy', async () => {
    await setup(false);
    expect(await screen.findByText('Go')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Language/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Copy/ })).toBeTruthy();
  });
});
