import type { IssueDetail, AvailableTransition } from '@bemmoly/module-work/shared';
import { Button, Menu, MenuItem, StatusGlyph, statusStage, Tooltip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useTransitions } from '../hooks/issue-detail.ts';
import { cx } from './cx.ts';
import { useIssueEdit } from './use-issue-edit.ts';

/** The text colour of each status category, on the big status button. */
const TONE = { todo: 'text-tx-2', in_progress: 'text-prog', done: 'text-done' } as const;

/** One-click buttons for the next transitions, at most this many. */
const QUICK = 3;

export interface StatusMenuProps {
  issue: IssueDetail;
  /** rail: the page's full-width button with quick transitions. compact: the peek's button. */
  variant?: 'rail' | 'compact';
}

/** Moves the issue at once with Undo; a refusal puts the old status back and offers Retry. */
function useMove(issue: IssueDetail) {
  const { edit } = useIssueEdit(issue.key);
  return (transition: AvailableTransition) =>
    edit({
      body: { statusId: transition.toStatusId },
      shown: {
        statusId: transition.toStatusId,
        status: {
          id: transition.toStatusId,
          name: transition.toStatusName,
          category: transition.toStatusCategory,
          color: null,
        },
      },
      what: `${issue.key}'s status`,
      undo: {
        title: `${issue.key} moved to ${transition.toStatusName}`,
        edit: {
          body: { statusId: issue.statusId },
          shown: { statusId: issue.statusId, status: issue.status },
          what: `${issue.key}'s status`,
        },
      },
    });
}

/**
 * Status first: the current status as a big button that opens every transition the workflow
 * offers, and one-click buttons for the next few. A blocked transition stays in the menu,
 * disabled, with the reason beside it.
 */
export function StatusMenu({ issue, variant = 'rail' }: StatusMenuProps) {
  const transitions = useTransitions(issue.key);
  const move = useMove(issue);
  const items = transitions.data ?? [];
  const quick = items.filter((transition) => transition.available).slice(0, QUICK);
  const stage = statusStage(issue.status.category, issue.status.name);
  const rail = variant === 'rail';

  return (
    <div className={cx('flex flex-col gap-2', !rail && 'items-start')}>
      <Menu
        trigger={(props) => (
          <button
            {...props}
            type="button"
            aria-label={`Status: ${issue.status.name}. Change status`}
            className={cx(
              'inline-flex h-control cursor-pointer items-center gap-2 rounded-control border-0 bg-card px-3 font-sans text-13 font-semibold shadow-e1 hover:shadow-e1h focus-ring',
              rail && 'w-full',
              TONE[issue.status.category],
            )}
          >
            <StatusGlyph stage={stage} label={issue.status.name} />
            <span className="min-w-0 flex-1 truncate text-left">{issue.status.name}</span>
            <Icon name="caret" size={14} className="text-tx-3" />
          </button>
        )}
      >
        {transitions.isPending && (
          <MenuItem disabled onSelect={() => undefined}>
            Loading transitions…
          </MenuItem>
        )}
        {transitions.isError && (
          <MenuItem onSelect={() => void transitions.refetch()}>
            Transitions could not be loaded. Retry
          </MenuItem>
        )}
        {transitions.isSuccess && items.length === 0 && (
          <MenuItem disabled onSelect={() => undefined}>
            No transitions from {issue.status.name}
          </MenuItem>
        )}
        {items.map((transition) => (
          <MenuItem
            key={transition.id}
            disabled={!transition.available}
            hint={transition.available ? transition.toStatusName : transition.blockedBy[0]}
            onSelect={() => move(transition)}
          >
            {transition.name}
          </MenuItem>
        ))}
      </Menu>
      {rail && quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Move to">
          {quick.map((transition) => (
            <Tooltip key={transition.id} label={`Move to ${transition.toStatusName}`}>
              <Button
                size="xs"
                variant="ghost"
                className="inset-ring inset-ring-line"
                icon={
                  <StatusGlyph
                    stage={statusStage(transition.toStatusCategory, transition.toStatusName)}
                    size={12}
                  />
                }
                onClick={() => move(transition)}
              >
                {transition.toStatusName}
              </Button>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}
