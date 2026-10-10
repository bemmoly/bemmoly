import type { SchemeDiffEntry } from '@bemmoly/module-work/shared';
import { Icon } from '@bemmoly/ui/icons';
import { Badge, Button, Modal } from '@bemmoly/ui';
import type { ReactNode } from 'react';

const CHANGE: Record<SchemeDiffEntry['change'], { label: string; tone: 'ok' | 'warn' | 'accent' }> =
  {
    added: { label: 'Added', tone: 'ok' },
    removed: { label: 'Removed', tone: 'warn' },
    changed: { label: 'Changed', tone: 'accent' },
  };

const show = (value: unknown): string =>
  value === undefined || value === null
    ? '–'
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);

/** The diff read the other way: what a reset does to the project's copy. */
export function invertDiff(entries: readonly SchemeDiffEntry[]): SchemeDiffEntry[] {
  const flip = { added: 'removed', removed: 'added', changed: 'changed' } as const;
  return entries.map(({ before, after, ...entry }) => ({
    ...entry,
    change: flip[entry.change],
    ...(after === undefined ? {} : { before: after }),
    ...(before === undefined ? {} : { after: before }),
  }));
}

/** The diff as rows: what, how it changed, and the value on each side. */
export function DiffRows({
  entries,
  empty,
}: {
  entries: readonly SchemeDiffEntry[];
  empty: string;
}) {
  if (entries.length === 0) return <p className="m-0 text-tx-3">{empty}</p>;
  return (
    <ul className="m-0 flex list-none flex-col rounded-card border border-line p-0">
      {entries.map((entry) => (
        <li
          key={entry.key}
          className="flex flex-col gap-1.5 border-b border-line-2 px-3.5 py-2.5 last:border-b-0"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{entry.label}</span>
            <Badge tone={CHANGE[entry.change].tone}>{CHANGE[entry.change].label}</Badge>
            {entry.attributes.length > 0 && (
              <span className="text-12 text-tx-3">{entry.attributes.join(', ')}</span>
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-2 text-13">
            <span className="break-words text-tx-3 line-through decoration-tx-3">
              {show(entry.before)}
            </span>
            <Icon name="arrow" size={14} label="becomes" className="self-center text-tx-3" />
            <span className="font-mono break-words text-tx">{show(entry.after)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface DiffDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  entries: readonly SchemeDiffEntry[];
  /** Shown when nothing differs. */
  empty: string;
  /** Present for a review before a write: names the action ("Save changes"). */
  confirmLabel?: string;
  busy?: boolean;
  /** A failed write, above the buttons. */
  error?: ReactNode;
  onConfirm?: () => void;
  onClose: () => void;
}

/**
 * The diff before anything is written, and the "View diff" panel: every
 * setting that differs, its old value struck through and its new one beside.
 */
export function DiffDialog(props: DiffDialogProps) {
  const review = Boolean(props.confirmLabel && props.onConfirm);
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      width="lg"
      title={props.title}
      description={props.description}
      footer={
        review ? (
          <>
            {props.error && <span className="mr-auto text-13 text-red">{props.error}</span>}
            <Button onClick={props.onClose}>Cancel</Button>
            <Button
              variant="primary"
              loading={props.busy ?? false}
              disabled={props.entries.length === 0}
              onClick={props.onConfirm}
            >
              {props.confirmLabel}
            </Button>
          </>
        ) : (
          <Button onClick={props.onClose}>Close</Button>
        )
      }
    >
      <DiffRows entries={props.entries} empty={props.empty} />
    </Modal>
  );
}
