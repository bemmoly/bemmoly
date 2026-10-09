import type { IssueDetail } from '@bemmoly/module-work/shared';
import { Menu, MenuItem, StatusButton, useToast } from '@bemmoly/ui';
import { useTransitions, useUpdateIssue } from '../hooks/issue-detail.ts';
import { statusTone } from './vocabulary.ts';

export interface StatusMenuProps {
  issue: IssueDetail;
  /** xl on the Issue page (32px), lg in the slide-over (30px). */
  size: 'lg' | 'xl';
}

/**
 * The status control: the current status as a button, opening the transitions the workflow
 * offers from it. A blocked transition stays in the list, disabled, with the reason beside it.
 */
export function StatusMenu({ issue, size }: StatusMenuProps) {
  const transitions = useTransitions(issue.key);
  const update = useUpdateIssue(issue.key);
  const toast = useToast();
  const items = transitions.data ?? [];

  const move = (toStatusId: string, name: string) =>
    update.mutate(
      { statusId: toStatusId },
      {
        onError: (error) =>
          toast.show({ tone: 'danger', title: `${issue.key} did not move`, body: error.message }),
        onSuccess: () => toast.show({ tone: 'ok', title: `${issue.key} moved to ${name}` }),
      },
    );

  return (
    <Menu
      trigger={(props) => (
        <StatusButton
          {...props}
          size={size}
          category={statusTone(issue.status.category, issue.status.name)}
          label={issue.status.name}
          aria-label={`Status: ${issue.status.name}. Change status`}
        />
      )}
    >
      {transitions.isPending && (
        <MenuItem disabled onSelect={() => undefined}>
          Loading transitions…
        </MenuItem>
      )}
      {transitions.isError && (
        <MenuItem disabled onSelect={() => undefined}>
          Transitions could not be loaded
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
          onSelect={() => move(transition.toStatusId, transition.toStatusName)}
        >
          {transition.name}
        </MenuItem>
      ))}
    </Menu>
  );
}
