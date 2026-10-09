import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { DocServices } from './services.ts';

/*
 * Images pasted or dropped into a page go through the host's upload and land where they were
 * put. Without an upload service the editor leaves the event to the browser and ProseMirror,
 * which keep an image only when it came with a URL.
 */

const imagesIn = (files: FileList | null | undefined) =>
  [...(files ?? [])].filter((file) => file.type.startsWith('image/'));

function insertUploads(view: EditorView, files: File[], at: number, services: DocServices) {
  const upload = services.uploadImage;
  if (!upload) return;
  for (const file of files) {
    void upload(file).then(
      (done) => {
        if (view.isDestroyed) return;
        const image = view.state.schema.nodes['image']!.create({
          src: done.src,
          alt: done.alt ?? file.name.replace(/\.[^.]+$/, ''),
        });
        const pos = Math.min(at, view.state.doc.content.size);
        view.dispatch(view.state.tr.insert(pos, image));
      },
      // A failed upload inserts nothing; the host's upload service reports the failure.
      () => undefined,
    );
  }
}

export function imageDrop(services: () => DocServices) {
  return Extension.create({
    name: 'imageDrop',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('imageDrop'),
          props: {
            handlePaste: (view, event) => {
              const files = imagesIn(event.clipboardData?.files);
              if (!files.length || !services().uploadImage) return false;
              insertUploads(view, files, view.state.selection.to, services());
              return true;
            },
            handleDrop: (view, event) => {
              const files = imagesIn(event.dataTransfer?.files);
              if (!files.length || !services().uploadImage) return false;
              const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
              insertUploads(view, files, at?.pos ?? view.state.selection.to, services());
              return true;
            },
          },
        }),
      ];
    },
  });
}
