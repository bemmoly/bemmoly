import { Button, Input } from '@bemmoly/ui';
import { useRef, useState, type FormEvent } from 'react';
import { cx } from '../../cx.ts';
import { SAFE_IMAGE_SRC } from '../../schema/nodes/values.ts';
import { useDocServices } from '../context.ts';
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

/** A new image: upload a file when the host can store one, or paste a link. */
function ImagePicker({ onPick }: { onPick: (attrs: { src: string; alt: string }) => void }) {
  const { uploadImage } = useDocServices();
  const [link, setLink] = useState('');
  const [state, setState] = useState<'idle' | 'uploading' | 'failed'>('idle');
  const file = useRef<HTMLInputElement>(null);

  const upload = async (picked: File | undefined) => {
    if (!picked || !uploadImage) return;
    setState('uploading');
    try {
      const done = await uploadImage(picked);
      onPick({ src: done.src, alt: done.alt ?? picked.name.replace(/\.[^.]+$/, '') });
    } catch {
      setState('failed');
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
              accept="image/*"
              hidden
              onChange={(event) => void upload(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="primary"
              loading={state === 'uploading'}
              onClick={() => file.current?.click()}
            >
              Upload
            </Button>
          </>
        )}
      </div>
      {state === 'failed' && (
        <span role="alert" className="text-12 text-red">
          The upload did not finish. Try again.
        </span>
      )}
    </form>
  );
}

function ImageChrome({ node, editor, updateAttributes }: NodeViewProps) {
  const src = String(node.attrs['src'] ?? '');
  const alt = String(node.attrs['alt'] ?? '');
  if (!src && editor.isEditable) return <ImagePicker onPick={updateAttributes} />;
  return <ImageFigure src={src} alt={alt} />;
}

export const imageView: ViewSpec = {
  tag: 'div',
  className: () => 'min-w-0',
  attrs: () => ({ 'data-type': 'image' }),
  Component: ImageChrome,
};
