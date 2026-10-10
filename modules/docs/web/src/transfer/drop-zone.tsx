import { formatBytes } from '@bemmoly/core-web';
import { Button, IconButton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useRef, useState, type DragEvent } from 'react';
import { cx } from '../comments/cx.ts';
import { EXTENSIONS, type ImportFormat, type PickedFile } from './read-files.ts';

export interface DropZoneProps {
  format: ImportFormat;
  files: readonly PickedFile[];
  onPick: (files: File[]) => void;
  onRemove: (path: string) => void;
}

/** Shown rows before the list says how many more there are. */
const SHOWN = 8;

/**
 * Where an import's files come from: dropped on the dashed box, or picked as files or as a
 * whole folder (whose tree becomes the page tree). The picked files list under it with
 * their size and a remove button each.
 */
export function DropZone({ format, files, onPick, onRemove }: DropZoneProps) {
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const accept = EXTENSIONS[format].join(',');

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    onPick([...event.dataTransfer.files]);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cx(
          'flex flex-col items-center gap-2 rounded-card border border-dashed px-4 py-6 text-center motion-safe:transition-colors',
          over ? 'border-ac bg-ac-bg2' : 'border-br3 bg-sf2',
        )}
      >
        <Icon name="download" size={18} className="rotate-180 text-tx4" />
        <p className="m-0 text-13 text-tx2">
          Drop {format === 'markdown' ? 'Markdown files' : 'exported HTML pages'} or a folder here
        </p>
        <p className="m-0 text-12 text-tx5">{EXTENSIONS[format].join(' ')} · up to 10 MB in all</p>
        <span className="mt-1 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => filesInput.current?.click()}>
            Choose files
          </Button>
          <Button size="sm" variant="ghost" onClick={() => folderInput.current?.click()}>
            Choose a folder
          </Button>
        </span>
        <input
          ref={filesInput}
          type="file"
          multiple
          accept={accept}
          aria-label="Files to import"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            onPick([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          aria-label="Folder to import"
          className="sr-only"
          tabIndex={-1}
          {...{ webkitdirectory: '' }}
          onChange={(event) => {
            onPick([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
      </div>
      {files.length > 0 && (
        <ul aria-label="Files to import" className="m-0 flex list-none flex-col p-0 text-12h">
          {files.slice(0, SHOWN).map((file) => (
            <li
              key={file.path}
              className="flex items-center gap-2 border-b border-br-row py-1.5 motion-safe:animate-rise"
            >
              <Icon name="doc" size={14} className="shrink-0 text-tx5" />
              <span className="min-w-0 flex-1 truncate font-mono text-12 text-tx2">
                {file.path}
              </span>
              <span className="shrink-0 text-11h text-tx5">{formatBytes(file.size)}</span>
              <IconButton
                label={`Remove ${file.path}`}
                icon="close"
                size="xs"
                onClick={() => onRemove(file.path)}
              />
            </li>
          ))}
          {files.length > SHOWN && (
            <li className="pt-1.5 text-12 text-tx5">and {files.length - SHOWN} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
