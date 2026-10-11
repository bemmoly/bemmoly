import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DocEditor from '../doc-editor.tsx';
import type { DocServices, UploadedImage, UploadOptions } from '../services.ts';
import { mapByDiff } from './remote-map.ts';

afterEach(cleanup);

const URL_OF = '/api/v1/files/0199c0de-0000-7000-8000-0000000000f1';

/** An upload the test finishes by hand, reporting progress as it likes. */
function controlledUpload() {
  const calls: { file: File; options: UploadOptions | undefined; settle: (ok: boolean) => void }[] =
    [];
  const upload = vi.fn(
    (file: File, options?: UploadOptions) =>
      new Promise<UploadedImage>((resolve, reject) => {
        calls.push({
          file,
          options,
          settle: (ok) =>
            ok ? resolve({ src: URL_OF }) : reject(new Error('That image is over 10 MB.')),
        });
      }),
  );
  return { upload, calls };
}

async function setup(services: DocServices, initialDoc?: object) {
  render(
    <DocEditor
      label="Page body"
      services={services}
      {...(initialDoc ? { initialDoc: initialDoc as never } : {})}
    />,
  );
  const box = await screen.findByRole('textbox', { name: 'Page body' });
  return (box as HTMLElement & { editor: Editor }).editor;
}

const png = (name = 'Screen Shot.png') =>
  new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });

function paste(editor: Editor, files: File[]): boolean {
  const event = { clipboardData: { files, getData: () => '' } } as unknown as ClipboardEvent;
  let handled = false;
  act(() => {
    handled = Boolean(
      editor.view.someProp('handlePaste', (f) => f(editor.view, event, null as never)),
    );
  });
  return handled;
}

const images = (editor: Editor) =>
  (editor.getJSON().content ?? []).filter((node) => node.type === 'image');

describe('pasted and dropped images', () => {
  it('shows progress where the image will land, then stores only its URL', async () => {
    const { upload, calls } = controlledUpload();
    const editor = await setup({ uploadImage: upload });
    expect(paste(editor, [png()])).toBe(true);

    expect(await screen.findByText('Screen Shot.png')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Uploading Screen Shot.png' });
    act(() => calls[0]!.options?.onProgress?.(0.5));
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    // Nothing is in the document while it uploads: collaborators see nothing half made.
    expect(images(editor)).toEqual([]);

    await act(async () => calls[0]!.settle(true));
    await waitFor(() => expect(images(editor)).toHaveLength(1));
    expect(images(editor)[0]!.attrs).toMatchObject({ src: URL_OF, alt: 'Screen Shot' });
    expect(JSON.stringify(editor.getJSON())).not.toContain('base64');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('says what went wrong inline, and tries again or removes the placeholder', async () => {
    const { upload, calls } = controlledUpload();
    const editor = await setup({ uploadImage: upload });
    paste(editor, [png('a.png'), png('b.png')]);
    await act(async () => calls[0]!.settle(false));
    await act(async () => calls[1]!.settle(false));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      'That image is over 10 MB.',
      'That image is over 10 MB.',
    ]);

    fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]!);
    expect(upload).toHaveBeenCalledTimes(3);
    await act(async () => calls[2]!.settle(true));
    await waitFor(() => expect(images(editor)).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(images(editor)).toHaveLength(1);
  });

  it('leaves pastes alone when the host cannot store files', async () => {
    const editor = await setup({});
    expect(paste(editor, [png()])).toBe(false);
  });

  it('ignores files that are not images', async () => {
    const { upload } = controlledUpload();
    const editor = await setup({ uploadImage: upload });
    expect(paste(editor, [new File(['x'], 'notes.txt', { type: 'text/plain' })])).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('alt text', () => {
  it('is edited in place on a selected image and kept on Enter', async () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: URL_OF, alt: 'Old' } }, { type: 'paragraph' }],
    };
    const editor = await setup({}, doc);
    act(() => {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)));
    });
    const field = await screen.findByRole('textbox', { name: 'Alt text' });
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: 'Login flow, three steps' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.blur(field);
    await waitFor(() => expect(images(editor)[0]!.attrs?.['alt']).toBe('Login flow, three steps'));
  });
});

describe('placeholders under live collaboration', () => {
  it('keep their place when someone else edits around them', async () => {
    const { schema } = await setup({});
    const para = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : []);
    const before = schema.node('doc', null, [para('one'), para('two')]);
    const between = before.child(0).nodeSize;
    // Text added in the first block moves it along; text added after it does not.
    const typedAbove = schema.node('doc', null, [para('one more'), para('two')]);
    expect(mapByDiff(before, typedAbove, between)).toBe(between + 5);
    const typedBelow = schema.node('doc', null, [para('one'), para('two more')]);
    expect(mapByDiff(before, typedBelow, between)).toBe(between);
  });
});
