import type { PairingMatrix } from '@bemmoly/module-work/shared';
import { Avatar, IconButton, RelativeTime } from '@bemmoly/ui';
import { gridOf } from './model.ts';

/*
 * One pair, under the matrix: who, how much they shared, when they last paired, and their
 * issues together, each opening in the peek. Escape and the close button hand focus back to
 * the matrix.
 */

export interface PairPanelProps {
  matrix: PairingMatrix;
  a: string;
  b: string;
  onClose: () => void;
  onOpenIssue: (key: string) => void;
}

export function PairPanel({ matrix, a, b, onClose, onOpenIssue }: PairPanelProps) {
  const name = (id: string) => matrix.people.find((person) => person.id === id)?.name ?? 'Someone';
  const cell = gridOf(matrix).cell(a, b);
  const title = `${name(a)} and ${name(b)}`;
  return (
    <section
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
      className="mt-4 max-w-160 rounded-card border border-line bg-card p-4"
    >
      <header className="flex items-center gap-2">
        <Avatar name={name(a)} size={20} />
        <Avatar name={name(b)} size={20} />
        <h2 className="m-0 min-w-0 flex-1 truncate text-14 font-semibold text-tx">{title}</h2>
        <IconButton icon="close" size="sm" label="Close the pair" onClick={onClose} />
      </header>
      {cell ? (
        <>
          <p className="mt-2 mb-3 text-13 text-tx-2">
            {cell.count} shared {cell.count === 1 ? 'issue' : 'issues'}, {cell.hours} hours
            together, last paired <RelativeTime iso={cell.lastPairedAt} />.
          </p>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {cell.issues.map((issue) => (
              <li key={issue.key}>
                <button
                  type="button"
                  onClick={() => onOpenIssue(issue.key)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-control border-0 bg-transparent px-2 py-1.5 text-left text-13 text-tx hover:bg-hover focus-ring"
                >
                  <span className="shrink-0 font-mono text-12 text-tx-2">{issue.key}</span>
                  <span className="min-w-0 truncate">{issue.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 mb-0 text-13 text-tx-2">
          They were never assigned to an issue at the same time in this range.
        </p>
      )}
    </section>
  );
}
