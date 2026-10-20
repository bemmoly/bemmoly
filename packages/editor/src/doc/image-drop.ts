import { Extension } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { DocServices } from './services.ts';
import { isRemoteReplace, mapByDiff } from './uploads/remote-map.ts';
import type { UploadStore } from './uploads/upload-store.ts';

/*
 * Images, PDFs and HTML files pasted or dropped into a page go through the host's upload. Until the upload
 * finishes, a local placeholder (a widget, mapped through every edit, so it moves with the
 * text around it) shows its progress or what went wrong; the image node, holding only the
 * URL the host returns, is inserted where the placeholder stands once it is done: an image,
 * or a File block for a document. Without the matching upload service the editor leaves the
 * event to the browser and ProseMirror.
 */

type Meta =
  | { add: { id: string; pos: number } }
  /** `placed`: where its image went, so placeholders pasted before it stay before it. */
  | { remove: string; placed?: { from: number; to: number } };

/** Uploads are numbered as they start ("upload-3"); a paste of several keeps that order. */
const seqOf = (id: unknown) => Number(String(id).split('-').pop());

export const imageUploadKey = new PluginKey<DecorationSet>('imageUpload');

/** The nearest place between top-level blocks at or after `at`, where an image may go. */
const betweenBlocks = ({ doc }: { doc: PmNode }, at: number) => {
  const $at = doc.resolve(Math.min(Math.max(at, 0), doc.content.size));
  return $at.depth > 0 ? $at.after(1) : $at.pos;
};

/** A PDF or HTML file, by its type or, when the browser gives none, its name. */
export const isDocumentFile = (file: File) =>
  file.type === 'application/pdf' ||
  file.type === 'text/html' ||
  (!file.type && /\.(html?|pdf)$/i.test(file.name));

const canStore = (file: File, services: DocServices) =>
  isDocumentFile(file)
    ? Boolean(services.uploadFile)
    : file.type.startsWith('image/') && Boolean(services.uploadImage);

/** The files of a paste or drop the host can store. */
const uploadable = (files: FileList | null | undefined, services: DocServices) =>
  [...(files ?? [])].filter((file) => canStore(file, services));

async function store(
  file: File,
  services: DocServices,
  view: EditorView,
  onProgress: (n: number | null) => void,
) {
  const { nodes } = view.state.schema;
  if (isDocumentFile(file)) {
    const done = await services.uploadFile!(file, { onProgress });
    return nodes['file']!.create({ src: done.src, name: done.name, mime: done.mime });
  }
  const done = await services.uploadImage!(file, { onProgress });
  return nodes['image']!.create({ src: done.src, alt: done.alt ?? altFromName(file.name) });
}

/** Where a pending upload's placeholder stands now, or null once it is gone. */
export function placeholderPos(state: EditorState, id: string): number | null {
  const set = imageUploadKey.getState(state);
  const found = set?.find(undefined, undefined, (spec) => spec['id'] === id) ?? [];
  return found[0]?.from ?? null;
}

const message = (error: unknown) =>
  error instanceof Error && error.message ? error.message : 'The upload did not finish.';

export const altFromName = (name: string) => name.replace(/\.[^.]+$/, '');

/** Uploads one file into its placeholder; also what Try again runs. */
export async function runUpload(
  view: EditorView,
  uploads: UploadStore,
  id: string,
  services: DocServices,
) {
  const entry = uploads.find(id);
  if (!entry || !canStore(entry.file, services)) return;
  uploads.update(id, { progress: 0, error: undefined });
  try {
    const image = await store(entry.file, services, view, (fraction) =>
      uploads.update(id, { progress: fraction }),
    );
    if (view.isDestroyed) return;
    const pos = placeholderPos(view.state, id);
    uploads.remove(id);
    if (pos === null) return;
    const at = betweenBlocks(view.state, pos);
    const tr: Transaction = view.state.tr
      .insert(at, image)
      .setMeta(imageUploadKey, { remove: id, placed: { from: at, to: at + image.nodeSize } });
    view.dispatch(tr);
  } catch (error) {
    if (!view.isDestroyed) uploads.update(id, { error: message(error) });
  }
}

/** Drops a pending upload and its placeholder, after a failure the person gave up on. */
export function dismissUpload(view: EditorView, uploads: UploadStore, id: string) {
  uploads.remove(id);
  if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(imageUploadKey, { remove: id }));
}

function startUploads(
  view: EditorView,
  files: File[],
  at: number,
  uploads: UploadStore,
  services: DocServices,
) {
  // Placeholders sit between blocks: at the end of the block the caret or the drop is in.
  const pos = betweenBlocks(view.state, at);
  for (const file of files) {
    const entry = uploads.add(file);
    view.dispatch(view.state.tr.setMeta(imageUploadKey, { add: { id: entry.id, pos } }));
    void runUpload(view, uploads, entry.id, services);
  }
}

export function imageDrop(services: () => DocServices, uploads: UploadStore) {
  return Extension.create({
    name: 'imageDrop',
    addProseMirrorPlugins() {
      return [
        new Plugin<DecorationSet>({
          key: imageUploadKey,
          state: {
            init: () => DecorationSet.empty,
            apply(tr, set) {
              let next = isRemoteReplace(tr)
                ? DecorationSet.create(
                    tr.doc,
                    set.find().flatMap((widget) => {
                      const element = uploads.find(String(widget.spec['id']))?.element;
                      if (!element) return [];
                      const pos = betweenBlocks(tr, mapByDiff(tr.before, tr.doc, widget.from));
                      return [Decoration.widget(pos, element, widget.spec)];
                    }),
                  )
                : set.map(tr.mapping, tr.doc);
              const meta = tr.getMeta(imageUploadKey) as Meta | undefined;
              if (meta && 'add' in meta) {
                const { id, pos } = meta.add;
                const element = uploads.find(id)?.element;
                if (element) {
                  const widget = Decoration.widget(pos, element, { id, key: id, side: 1 });
                  next = next.add(tr.doc, [widget]);
                }
              } else if (meta && 'remove' in meta) {
                next = next.remove(
                  next.find(undefined, undefined, (spec) => spec['id'] === meta.remove),
                );
                const { placed } = meta;
                const earlier = placed
                  ? next.find(
                      placed.to,
                      placed.to,
                      (spec) => seqOf(spec['id']) < seqOf(meta.remove),
                    )
                  : [];
                if (placed && earlier.length) {
                  next = next.remove(earlier).add(
                    tr.doc,
                    earlier.map((widget) =>
                      Decoration.widget(
                        placed.from,
                        uploads.find(String(widget.spec['id']))!.element,
                        widget.spec,
                      ),
                    ),
                  );
                }
              }
              return next;
            },
          },
          props: {
            decorations: (state) => imageUploadKey.getState(state),
            handlePaste: (view, event) => {
              const files = uploadable(event.clipboardData?.files, services());
              if (!files.length) return false;
              startUploads(view, files, view.state.selection.to, uploads, services());
              return true;
            },
            handleDrop: (view, event) => {
              const files = uploadable(event.dataTransfer?.files, services());
              if (!files.length) return false;
              event.preventDefault();
              const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
              startUploads(view, files, at?.pos ?? view.state.selection.to, uploads, services());
              return true;
            },
          },
        }),
      ];
    },
  });
}
