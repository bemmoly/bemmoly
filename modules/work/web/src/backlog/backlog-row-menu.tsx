import type { Issue } from '@bemmoly/module-work/shared';
import { useContext } from 'react';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import { IssueActionsMenu } from '../shared/issue-actions-menu.tsx';
import { BacklogMenuContext } from './backlog-row-context.ts';

const NONE: readonly string[] = [];

/**
 * A backlog row's ··· menu. It follows the selection itself, and only while its row is in it,
 * so selecting rows or dropping them never redraws every row to hand each menu its targets.
 */
export function BacklogRowMenu({ issue }: { issue: Issue }) {
  const shared = useContext(BacklogMenuContext);
  const selection = useBacklogUi((state) =>
    state.selection.ids.includes(issue.id) ? state.selection.ids : NONE,
  );
  if (!shared) return null;
  const targets =
    selection.length > 0 ? selection.flatMap((id) => shared.keyOf.get(id) ?? []) : undefined;
  return (
    <IssueActionsMenu
      issueKey={issue.key}
      assigneeId={issue.assigneeId}
      priority={issue.priority}
      sprintId={issue.sprintId}
      meId={shared.meId}
      actions={shared.quick}
      sprints={shared.sprints}
      onOpen={() => shared.open(issue.key)}
      {...(targets ? { targets } : {})}
    />
  );
}

/** The row context's menu: one stable function, so the rows never redraw for it. */
export const rowMenu = (issue: Issue) => <BacklogRowMenu issue={issue} />;
