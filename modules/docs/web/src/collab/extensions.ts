import type { AvatarHue } from '@bemmoly/ui';
import type { DocEditorProps } from '@bemmoly/editor';
import { editorSchema } from '@bemmoly/editor/schema';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import type { Doc } from 'yjs';
import type { RichText } from '../../../shared/common.ts';
import { FROM_SEED } from './origins.ts';
import type { CollabSession } from './session.ts';
import type { CollabUser } from './user.ts';

type AnyExtension = NonNullable<DocEditorProps['extensions']>[number];

/*
 * The editor half of collaboration, in its own chunk so Tiptap loads with the editor and not
 * with the Docs screens. Carets are drawn with the avatar palette's classes rather than
 * inline colours: the content security policy allows no style attributes.
 */

/** Must match the server's PAGE_FIELD: Tiptap's default. */
const FIELD = 'default';

const CARET: Record<AvatarHue, { caret: string; label: string; selection: string }> = {
  accent: { caret: 'border-ac', label: 'bg-ac-av text-ac', selection: 'bg-ac-av' },
  grey: { caret: 'border-tx4', label: 'bg-chip text-tx3', selection: 'bg-chip' },
  green: { caret: 'border-green-fg', label: 'bg-green-bg text-green-fg', selection: 'bg-green-bg' },
  orange: {
    caret: 'border-orange-fg',
    label: 'bg-orange-bg text-orange-fg',
    selection: 'bg-orange-bg',
  },
  violet: {
    caret: 'border-violet-fg',
    label: 'bg-violet-bg text-violet-fg',
    selection: 'bg-violet-bg',
  },
  pink: { caret: 'border-pink-fg', label: 'bg-pink-bg text-pink-fg', selection: 'bg-pink-bg' },
  amber: { caret: 'border-amber-fg', label: 'bg-amber-bg text-amber-fg', selection: 'bg-amber-bg' },
  sky: { caret: 'border-sky-fg', label: 'bg-sky-bg text-sky-fg', selection: 'bg-sky-bg' },
};

const colours = (user: Record<string, unknown>) =>
  CARET[(user['hue'] as AvatarHue | undefined) ?? 'grey'] ?? CARET.grey;

/** A caret: a one-pixel line in the person's colour with their name above it. */
function renderCaret(user: Record<string, unknown>): HTMLElement {
  const { caret, label } = colours(user);
  const line = document.createElement('span');
  line.className = `pointer-events-none relative -mx-px border-x break-normal ${caret}`;
  line.setAttribute('data-collab-caret', String(user['id'] ?? ''));
  const name = document.createElement('span');
  name.className = `absolute bottom-full -left-px rounded-chip rounded-bl-none px-1.5 py-0.5 text-11 leading-none font-semibold whitespace-nowrap select-none ${label}`;
  name.textContent = String(user['name'] ?? '');
  line.append(name);
  return line;
}

/**
 * Collaboration (the shared document and Yjs undo) and the carets of everyone else on the
 * page. Pass them to DocEditor's `extensions` and leave `initialDoc` out.
 */
export function collabExtensions(session: CollabSession, user: CollabUser): AnyExtension[] {
  const extensions: AnyExtension[] = [
    Collaboration.configure({ document: session.doc, field: FIELD }),
  ];
  if (session.provider) {
    extensions.push(
      CollaborationCaret.configure({
        provider: session.provider,
        user,
        render: renderCaret,
        selectionRender: (other) => ({ nodeName: 'span', class: colours(other).selection }),
      }),
    );
  }
  return extensions;
}

/** Local mode only: the page's stored snapshot as the starting document. */
export function seedLocal(doc: Doc, snapshot: RichText | null | undefined): void {
  if (!snapshot || doc.getXmlFragment(FIELD).length > 0) return;
  doc.transact(() => {
    prosemirrorJSONToYXmlFragment(editorSchema(), snapshot, doc.getXmlFragment(FIELD));
  }, FROM_SEED);
}

/** Local mode only: the document as the page's stored snapshot, to keep the mock's copy. */
export function localSnapshot(doc: Doc): RichText {
  return yXmlFragmentToProsemirrorJSON(doc.getXmlFragment(FIELD)) as RichText;
}

/**
 * Local mode only: the stored body changed outside the editor (a restore, an applied fix),
 * so the tab's document takes it, as a collab server would push it. `origin` marks the
 * change so it is not written back.
 */
export function replaceLocal(doc: Doc, snapshot: RichText, origin: unknown): void {
  // Applied as a diff against what the tab has, inside one transaction tagged `origin`.
  doc.transact(() => {
    prosemirrorJSONToYXmlFragment(editorSchema(), snapshot, doc.getXmlFragment(FIELD));
  }, origin);
}
