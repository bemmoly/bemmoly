import { Button, Input, ProgressBar } from '@bemmoly/ui';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { cx } from '../../cx.ts';
import { SAFE_IMAGE_SRC } from '../../schema/nodes/values.ts';
import { useDocServices } from '../context.ts';
import { altFromName } from '../image-drop.ts';
import type { NodeViewProps, ViewSpec } from '../portals.ts';
import {
  IMAGE,
  IMAGE_CAPTION,
  IMAGE_FRAME,
  PLACEHOLDER_CARD,
  PLACEHOLDER_TITLE,
} from '../styles.ts';

/** A stored image as the reader sees it; an unsafe or empty source prints its alt text. */
export function ImageFigure({ src, alt }: { src: string; alt: string }) {
  if (!SAFE_IMAGE_SRC.test(src)) {
    return alt ? <p className={IMAGE_CAPTION}>{alt}</p> : null;
  }
  return (
    <figure className={cx(IMAGE_FRAME, 'm-0')}>
      <img src={src} alt={alt} loading="lazy" className={IMAGE} />
      {alt && <figcaption className={IMAGE_CAPTION}>{alt}</figcaption>}
    </figure>
  );
}

type PickState =
  | { kind: 'idle' }
  | { kind: 'uploading'; progress: number | null }
  | { kind: 'failed'; message: string };

/** A new image: upload a file when the host can store one, or paste a link. */
function ImagePicker({ onPick }: { onPick: (attrs: { src: string; alt: string }) => void }) {
  const { uploadImage } = useDocServices();
  const [link, setLink] = useState('');
  const [state, setState] = useState<PickState>({ kind: 'idle' });
  const file = useRef<HTMLInputElement>(null);

  const upload = async (picked: File | undefined) => {
    if (!picked || !uploadImage) return;
    setState({ kind: 'uploading', progress: 0 });
    try {
      const done = await uploadImage(picked, {
        onProgress: (progress) => setState({ kind: 'uploading', progress }),
      });
      onPick({ src: done.src, alt: done.alt ?? altFromName(picked.name) });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '';
      setState({ kind: 'failed', message: message || 'The upload did not finish. Try again.' });
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (SAFE_IMAGE_SRC.test(link.trim())) onPick({ src: link.trim(), alt: '' });
  };

  return (
    <form onSubmit={submit} className={cx(PLACEHOLDER_CARD, 'gap-2')}>
      <span className={PLACEHOLDER_TITLE}>Image</span>
      <div className="flex items-center gap-2">
        <Input
          aria-label="Image link"
          placeholder="https://"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          wrapperClassName="min-w-0 flex-1"
        />
        <Button type="submit" variant="secondary" disabled={!SAFE_IMAGE_SRC.test(link.trim())}>
          Add link
        </Button>
        {uploadImage && (
          <>
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={(event) => void upload(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="primary"
              loading={state.kind === 'uploading'}
              onClick={() => file.current?.click()}
            >
              Upload
            </Button>
          </>
        )}
      </div>
      {state.kind === 'uploading' && (
        <ProgressBar
          value={Math.round((state.progress ?? 0) * 100)}
          size="xs"
          fillClassName="bg-prog"
          label="Uploading image"
        />
      )}
      {state.kind === 'failed' && (
        <span role="alert" className="text-12 text-red">
          {state.message}
        </span>
      )}
    </form>
  );
}

/** The image's alt text, edited in place: Enter or leaving the field keeps it, Escape does not. */
function AltText({ alt, onSave }: { alt: string; onSave: (alt: string) => void }) {
  const [draft, setDraft] = useState(alt);
  const [seen, setSeen] = useState(alt);
  if (alt !== seen) {
    // Someone else changed it (a collaborator, an undo): show theirs.
    setSeen(alt);
    setDraft(alt);
  }
  const save = () => {
    const next = draft.trim();
    if (next !== alt) onSave(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setDraft(alt);
      event.currentTarget.blur();
    }
  };
  return (
    <Input
      aria-label="Alt text"
      placeholder="Describe the image for people who cannot see it"
      value={draft}
      maxLength={500}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={onKeyDown}
      wrapperClassName="w-full max-w-120"
    />
  );
}

function ImageChrome({ node, editor, selected, updateAttributes }: NodeViewProps) {
  const src = String(node.attrs['src'] ?? '');
  const alt = String(node.attrs['alt'] ?? '');
  const [editing, setEditing] = useState(false);
  if (!src && editor.isEditable) return <ImagePicker onPick={updateAttributes} />;
  if (!editor.isEditable || !SAFE_IMAGE_SRC.test(src)) return <ImageFigure src={src} alt={alt} />;
  return (
    <figure
      className={cx(IMAGE_FRAME, 'm-0 select-none')}
      onFocus={() => setEditing(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEditing(false);
      }}
    >
      <img src={src} alt={alt} loading="lazy" className={IMAGE} />
      {selected || editing ? (
        <AltText alt={alt} onSave={(next) => updateAttributes({ alt: next })} />
      ) : (
        alt && <figcaption className={IMAGE_CAPTION}>{alt}</figcaption>
      )}
    </figure>
  );
}

export const imageView: ViewSpec = {
  tag: 'div',
  className: () => 'min-w-0',
  attrs: () => ({ 'data-type': 'image' }),
  Component: ImageChrome,
};
