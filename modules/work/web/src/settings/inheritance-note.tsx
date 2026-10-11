import { Icon } from '@bemmoly/ui/icons';
import { onLinkClick } from '../workflow/navigate.ts';

const LINK =
  'shrink-0 rounded-chip font-semibold text-acc no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc';

/**
 * Where a project's settings come from, said in one line on the accent wash (the review's
 * "Based on Software · Scrum, with 5 changes for this project · Compare"). It replaces the
 * bordered "Inherits from" card, which read like a form row. For workspace admins it also
 * leads to the org default itself, in Settings › Work.
 */
export function InheritanceNote({
  origin,
  changes,
  overridden = true,
  onCompare,
  defaultHref,
}: {
  origin: string;
  changes: number;
  /** False while the project still follows the default as is. */
  overridden?: boolean;
  onCompare: () => void;
  /** The org default's page; only workspace admins, who can change it, get the link. */
  defaultHref?: string | undefined;
}) {
  const tail = !overridden
    ? ', unchanged for this project.'
    : changes === 0
      ? ', with no changes yet for this project.'
      : `, with ${changes} ${changes === 1 ? 'change' : 'changes'} for this project.`;
  return (
    <div className="flex items-center gap-2 rounded-card bg-acc-50 px-3 py-2.25 text-13 text-tx-2 max-sm:flex-wrap">
      <Icon name="layers" size={15} className="shrink-0 text-acc" />
      <span className="min-w-0 flex-1">
        Based on <b className="font-semibold text-tx">{origin}</b>
        {tail}
      </span>
      <span className="flex shrink-0 items-center gap-3 max-sm:ml-6">
        <button type="button" className={LINK} onClick={onCompare}>
          Compare
        </button>
        {defaultHref ? (
          <a href={defaultHref} className={LINK} onClick={onLinkClick(defaultHref)}>
            Edit org default
          </a>
        ) : null}
      </span>
    </div>
  );
}
