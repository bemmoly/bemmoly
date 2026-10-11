import { Button, ProgressBar } from '@bemmoly/ui';
import type { Editor } from '@tiptap/core';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../cx.ts';
import { dismissUpload, runUpload } from '../image-drop.ts';
import type { DocServices } from '../services.ts';
import { PLACEHOLDER_CARD, PLACEHOLDER_TITLE } from '../styles.ts';
import type { PendingUpload, UploadStore } from './upload-store.ts';

interface PendingUploadsProps {
  editor: Editor;
  store: UploadStore;
  services: DocServices;
}

function UploadCard({
  entry,
  editor,
  store,
  services,
}: PendingUploadsProps & { entry: PendingUpload }) {
  const percent = Math.round((entry.progress ?? 0) * 100);
  return (
    <div
      className={cx(PLACEHOLDER_CARD, 'my-2 gap-2')}
      data-upload-state={entry.error ? 'failed' : 'uploading'}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className={cx(PLACEHOLDER_TITLE, 'min-w-0 truncate')}>
          {entry.file.name || 'Image'}
        </span>
        {!entry.error && (
          <span className="shrink-0 text-12 tabular-nums text-tx-3" aria-hidden>
            {entry.progress === null ? 'Uploading…' : `${percent}%`}
          </span>
        )}
      </div>
      {entry.error ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span role="alert" className="text-12 text-red">
            {entry.error}
          </span>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => dismissUpload(editor.view, store, entry.id)}
            >
              Remove
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => void runUpload(editor.view, store, entry.id, services)}
            >
              Try again
            </Button>
          </span>
        </div>
      ) : (
        <ProgressBar
          value={percent}
          size="xs"
          fillClassName="bg-prog"
          label={`Uploading ${entry.file.name || 'image'}`}
        />
      )}
    </div>
  );
}

/** Draws each pending upload's placeholder into the element its widget put in the page. */
export function PendingUploads(props: PendingUploadsProps) {
  const entries = useSyncExternalStore(props.store.subscribe, props.store.get);
  return (
    <>
      {entries.map((entry) =>
        createPortal(<UploadCard {...props} entry={entry} />, entry.element, entry.id),
      )}
    </>
  );
}
