import { editorSchema } from '@bemmoly/editor/schema';
import {
  prosemirrorJSONToYDoc,
  prosemirrorJSONToYXmlFragment,
  yXmlFragmentToProsemirrorJSON,
} from '@tiptap/y-tiptap';
import { encodeStateAsUpdate, type Doc } from 'yjs';
import type { RichText } from '../../../../shared/common.ts';

/**
 * The Yjs field a page's body lives in. Tiptap's Collaboration extension uses "default"
 * unless told otherwise, and the web client leaves it so.
 */
export const PAGE_FIELD = 'default';

/** A ProseMirror snapshot (a template, a seed, an import) as the update that builds it. */
export function snapshotToUpdate(snapshot: RichText): Uint8Array {
  return encodeStateAsUpdate(prosemirrorJSONToYDoc(editorSchema(), snapshot, PAGE_FIELD));
}

/** The page body as the ProseMirror JSON the pages table stores. */
export function docToSnapshot(doc: Doc): RichText {
  return yXmlFragmentToProsemirrorJSON(doc.getXmlFragment(PAGE_FIELD)) as RichText;
}

/**
 * Makes the page body equal to the snapshot with the smallest change: unchanged blocks keep
 * their Yjs identity, so a cursor in an untouched paragraph stays put.
 */
export function writeSnapshot(doc: Doc, snapshot: RichText): void {
  prosemirrorJSONToYXmlFragment(editorSchema(), snapshot, doc.getXmlFragment(PAGE_FIELD));
}
