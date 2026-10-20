import { Button, FileEmbed, fileEmbedKind, ProgressBar } from '@bemmoly/ui';
import { useRef, useState } from 'react';
import { cx } from '../../cx.ts';
import { fileName } from '../../schema/nodes/file.ts';
import { useDocServices } from '../context.ts';
import type { NodeViewProps, ViewSpec } from '../portals.ts';
import { IMAGE_CAPTION, PLACEHOLDER_CARD, PLACEHOLDER_TITLE } from '../styles.ts';

/**
 * Only files Bemmoly stored (and the dev mock's blob: URLs) are framed: the server's headers,
 * not the block's own attributes, decide how a stored file may run (ADR 0037).
 */
const STORED_FILE = /^(\/api\/v1\/files\/[0-9a-f-]{36}|blob:)/i;

/** What the file input offers; the server still decides from the bytes. */
const ACCEPT = '.html,.htm,.pdf,text/html,application/pdf';

/** A stored PDF or HTML file as the reader sees it; one that cannot be shown prints its name. */
export function FileBlock({ src, name, mime }: { src: string; name: string; mime: string }) {
  const kind = fileEmbedKind(mime);
  const label = fileName(name, mime);
  if (!STORED_FILE.test(src) || (kind !== 'html' && kind !== 'pdf')) {
    return <p className={IMAGE_CAPTION}>{label}</p>;
  }
  return <FileEmbed src={src} name={label} kind={kind} />;
}

type PickState =
  | { kind: 'idle' }
  | { kind: 'uploading'; progress: number | null }
  | { kind: 'failed'; message: string };

/** A new File block: pick a PDF or HTML file to upload into the page. */
function FilePicker({
  onPick,
}: {
  onPick: (attrs: { src: string; name: string; mime: string }) => void;
}) {
  const { uploadFile } = useDocServices();
  const [state, setState] = useState<PickState>({ kind: 'idle' });
  const input = useRef<HTMLInputElement>(null);

  const upload = async (picked: File | undefined) => {
    if (!picked || !uploadFile) return;
    setState({ kind: 'uploading', progress: 0 });
    try {
      const done = await uploadFile(picked, {
        onProgress: (progress) => setState({ kind: 'uploading', progress }),
      });
      onPick({ src: done.src, name: done.name, mime: done.mime });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '';
      setState({ kind: 'failed', message: message || 'The upload did not finish. Try again.' });
    }
  };

  return (
    <div className={cx(PLACEHOLDER_CARD, 'gap-2')}>
      <span className={PLACEHOLDER_TITLE}>File</span>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-13 text-tx-3">
          A PDF or an HTML page, shown here and full screen
        </span>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="primary"
          disabled={!uploadFile}
          loading={state.kind === 'uploading'}
          onClick={() => input.current?.click()}
        >
          Upload
        </Button>
      </div>
      {state.kind === 'uploading' && (
        <ProgressBar
          value={Math.round((state.progress ?? 0) * 100)}
          size="xs"
          fillClassName="bg-prog"
          label="Uploading file"
        />
      )}
      {state.kind === 'failed' && (
        <span role="alert" className="text-12 text-red">
          {state.message}
        </span>
      )}
    </div>
  );
}

function FileChrome({ node, editor, updateAttributes }: NodeViewProps) {
  const src = String(node.attrs['src'] ?? '');
  if (!src && editor.isEditable) return <FilePicker onPick={updateAttributes} />;
  return (
    <FileBlock
      src={src}
      name={String(node.attrs['name'] ?? '')}
      mime={String(node.attrs['mime'] ?? '')}
    />
  );
}

export const fileView: ViewSpec = {
  tag: 'div',
  className: () => 'min-w-0',
  attrs: () => ({ 'data-type': 'file' }),
  Component: FileChrome,
};
