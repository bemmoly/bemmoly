import {
  useHeaderTrail,
  useRecordRecent,
  useScreenActions,
  type ScreenAction,
} from '@bemmoly/core-web';
import type { IssueDetail } from '@bemmoly/module-work/shared';
import { TypeGlyph, useToast } from '@bemmoly/ui';
import { useTransitions, useUpdateIssue } from '../hooks/issue-detail.ts';
import { useViewer } from '../hooks/issue-people.ts';
import { workPaths } from '../hooks/issue-navigation.ts';
import { typeGlyph } from './vocabulary.ts';

const issueLook = (issue: IssueDetail) => ({
  kind: 'issue' as const,
  type: { key: issue.type.key, icon: issue.type.icon, level: issue.type.level },
  status: { category: issue.status.category, name: issue.status.name },
});

/**
 * What the shell knows about the open issue: it is a recent item, the trail ends in its epic
 * and its key with the type tile, and ⌘K offers "Assign to me" and its next statuses.
 */
export function useIssuePresence(issue: IssueDetail | undefined, projectName: string | undefined) {
  const viewer = useViewer();
  const key = issue?.key ?? '';
  const transitions = useTransitions(key, Boolean(issue));
  const update = useUpdateIssue(key);
  const toast = useToast();

  useRecordRecent(
    issue
      ? {
          id: `work.issue:${issue.key}`,
          title: issue.title,
          handle: issue.key,
          ...(projectName ? { context: projectName } : {}),
          path: workPaths.issue(issue.key),
          look: issueLook(issue),
          group: 'Issues',
        }
      : null,
  );

  useHeaderTrail(
    issue
      ? [
          ...(issue.parent
            ? [{ label: issue.parent.title, path: workPaths.issue(issue.parent.key) }]
            : []),
          {
            label: issue.key,
            path: workPaths.issue(issue.key),
            icon: <TypeGlyph type={typeGlyph(issue.type)} size={14} />,
          },
        ]
      : null,
  );

  const done = (title: string) => ({
    onError: (error: Error) =>
      toast.show({ tone: 'danger', title: `${key} was not changed`, body: error.message }),
    onSuccess: () => toast.show({ tone: 'ok', title }),
  });
  const actions: ScreenAction[] = issue
    ? [
        ...(viewer && issue.assignee?.id !== viewer.id
          ? [
              {
                id: 'work.assign-me',
                title: `Assign ${issue.key} to me`,
                keywords: ['assign', 'me', 'take'],
                look: { kind: 'icon' as const, icon: 'me' },
                run: () => update.mutate({ assigneeId: viewer.id }, done(`${issue.key} is yours`)),
              },
            ]
          : []),
        ...(transitions.data ?? [])
          .filter((transition) => transition.available)
          .map((transition) => ({
            id: `work.move:${transition.id}`,
            title: `Move ${issue.key} to ${transition.toStatusName}`,
            keywords: ['status', 'change', transition.name],
            look: {
              kind: 'status' as const,
              category: transition.toStatusCategory,
              name: transition.toStatusName,
            },
            run: () =>
              update.mutate(
                { statusId: transition.toStatusId },
                done(`${issue.key} moved to ${transition.toStatusName}`),
              ),
          })),
      ]
    : [];
  useScreenActions(issue ? actions : null);
}
