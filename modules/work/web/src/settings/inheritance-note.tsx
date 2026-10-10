import { Icon } from '@bemmoly/ui/icons';

/**
 * Where a project's settings come from, said in one line on the accent wash (the review's
 * "Based on Software · Scrum, with 5 changes for this project · Compare"). It replaces the
 * bordered "Inherits from" card, which read like a form row.
 */
export function InheritanceNote({
  origin,
  changes,
  overridden = true,
  onCompare,
}: {
  origin: string;
  changes: number;
  /** False while the project still follows the default as is. */
  overridden?: boolean;
  onCompare: () => void;
}) {
  const tail = !overridden
    ? ', unchanged for this project.'
    : changes === 0
      ? ', with no changes yet for this project.'
      : `, with ${changes} ${changes === 1 ? 'change' : 'changes'} for this project.`;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-acc-50 px-3 py-2.25 text-13 text-tx-2">
      <Icon name="layers" size={15} className="shrink-0 text-acc" />
      <span className="min-w-0">
        Based on <b className="font-semibold text-tx">{origin}</b>
        {tail}
      </span>
      <button
        type="button"
        className="ml-auto shrink-0 rounded-chip font-semibold text-acc hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc"
        onClick={onCompare}
      >
        Compare
      </button>
    </div>
  );
}
