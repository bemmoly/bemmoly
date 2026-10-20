import { useState } from 'react';
import { Icon, type IconName } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { IconButton } from '../button/icon-button.tsx';
import { Modal } from '../modal/modal.tsx';

export type FileEmbedKind = 'html' | 'pdf' | 'image';

/** The kind a stored file is drawn as, from its sniffed type; null for anything else. */
export function fileEmbedKind(mime: string): FileEmbedKind | null {
  if (mime === 'text/html') return 'html';
  if (mime === 'application/pdf') return 'pdf';
  return mime.startsWith('image/') ? 'image' : null;
}

const LOOK: Record<FileEmbedKind, { icon: IconName; label: string }> = {
  html: { icon: 'code', label: 'HTML' },
  pdf: { icon: 'doc', label: 'PDF' },
  image: { icon: 'image', label: 'Image' },
};

/*
 * HTML runs with scripts on but without allow-same-origin: the frame gets an origin of its own,
 * so it can reach neither the session nor the page around it (ADR 0037). Browsers refuse to
 * draw a PDF in a sandbox, so a PDF frame has none; the browser's viewer runs it.
 */
const HTML_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';

export interface FileEmbedProps {
  src: string;
  name: string;
  kind: FileEmbedKind;
  /** Who added it ("Added by Mira"), shown beside the kind so a framed form never passes for the app. */
  byline?: string;
  className?: string;
}

function FileBar({
  src,
  name,
  kind,
  byline,
  onExpand,
  onClose,
}: Omit<FileEmbedProps, 'className'> & { onExpand?: () => void; onClose?: () => void }) {
  const look = LOOK[kind];
  return (
    <div className="flex min-h-10 shrink-0 items-center gap-2 border-b border-line bg-sunken px-3 py-1.5">
      <Icon name={look.icon} className="shrink-0 text-tx-3" />
      <span className="min-w-0 truncate text-13 font-semibold text-tx">{name}</span>
      <span className="shrink-0 text-12 text-tx-3">
        {byline ? `${look.label} · ${byline}` : look.label}
      </span>
      <span className="flex-1" />
      {kind === 'html' ? (
        <IconButton
          label={`Download ${name}`}
          tip="Download"
          icon="download"
          size="xs"
          onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}
        />
      ) : (
        <IconButton
          label={`Open ${name} in a new tab`}
          tip="Open in a new tab"
          icon="external"
          size="xs"
          onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}
        />
      )}
      {onExpand && (
        <IconButton
          label={`Expand ${name}`}
          tip="Full screen"
          icon="expand"
          size="xs"
          onClick={onExpand}
        />
      )}
      {onClose && <IconButton label="Close" icon="close" size="xs" onClick={onClose} />}
    </div>
  );
}

function FileBody({
  src,
  name,
  kind,
  full,
}: {
  src: string;
  name: string;
  kind: FileEmbedKind;
  full: boolean;
}) {
  if (kind === 'image') {
    return (
      <div
        className={cx(
          'flex min-h-0 flex-1 items-center justify-center bg-sunken',
          full ? 'p-4' : 'p-2',
        )}
      >
        <img src={src} alt={name} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return (
    <iframe
      src={src}
      title={name}
      loading="lazy"
      referrerPolicy="no-referrer"
      {...(kind === 'html' ? { sandbox: HTML_SANDBOX } : {})}
      className="block min-h-0 w-full flex-1 border-0 bg-card"
    />
  );
}

export interface FileViewerProps extends Omit<FileEmbedProps, 'className'> {
  open: boolean;
  onClose: () => void;
}

/**
 * A file full screen: the same bar naming it, the file filling the window, Escape or Close to
 * leave. The frame exists only while it is open.
 */
export function FileViewer({ open, onClose, ...file }: FileViewerProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={file.name}
      width="full"
      flush
      header={<FileBar {...file} onClose={onClose} />}
    >
      <div className="flex h-full">
        {open && <FileBody src={file.src} name={file.name} kind={file.kind} full />}
      </div>
    </Modal>
  );
}

/**
 * A file shown in place: a bar naming it and what it is, then the file in a fixed-height box,
 * with Expand to see it full screen and a way to open or download it alone. HTML runs
 * sandboxed.
 */
export function FileEmbed({ className, ...file }: FileEmbedProps) {
  const [full, setFull] = useState(false);
  return (
    <div
      className={cx(
        'flex flex-col overflow-hidden rounded-card border border-line bg-card',
        className,
      )}
    >
      <FileBar {...file} onExpand={() => setFull(true)} />
      <div className={cx('flex', file.kind === 'image' ? 'max-h-120' : 'h-90')}>
        <FileBody src={file.src} name={file.name} kind={file.kind} full={false} />
      </div>
      <FileViewer {...file} open={full} onClose={() => setFull(false)} />
    </div>
  );
}
