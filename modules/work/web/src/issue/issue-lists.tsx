import type { IssueDetail, IssueLinkView } from '@bemmoly/module-work/shared';
import {
  IssueSection,
  LinkedIssueRow,
  ListCard,
  ListGroupLabel,
  ProgressBar,
  SectionHeading,
  SubtaskRow,
} from '@bemmoly/ui';
import { useSubtasks } from '../hooks/issue-detail.ts';
import { workPaths } from '../hooks/issue-navigation.ts';
import { usePeople } from '../hooks/issue-people.ts';
import type { IssueVocabulary } from '../hooks/issue-vocabulary.ts';

interface ListProps {
  issue: IssueDetail;
  vocabulary: IssueVocabulary;
  size: 'page' | 'panel';
}

/** "2 of 4 done", the green 4px bar and one row per subtask with its assignee and status. */
export function SubtasksSection({ issue, vocabulary, size }: ListProps) {
  const rows = useSubtasks(issue.id).data ?? issue.subtasks;
  const { person } = usePeople();
  if (rows.length === 0) return null;
  const done = rows.filter((row) => vocabulary.rowStatus(row.statusId).done).length;
  return (
    <IssueSection
      heading={
        <SectionHeading title="Subtasks" hint={`${done} of ${rows.length} done`} size={size} />
      }
    >
      <ProgressBar value={(done / rows.length) * 100} size="xs" label="Subtasks done" />
      <ListCard>
        {rows.map((row) => {
          const status = vocabulary.rowStatus(row.statusId);
          const assigneeId = 'assigneeId' in row ? (row.assigneeId as string | null) : null;
          return (
            <SubtaskRow
              key={row.id}
              href={workPaths.issue(row.key)}
              issueKey={row.key}
              title={row.title}
              type={vocabulary.glyph(row.typeId)}
              done={status.done}
              status={status}
              {...(assigneeId && size === 'page'
                ? { assignee: { name: person(assigneeId).name } }
                : {})}
            />
          );
        })}
      </ListCard>
    </IssueSection>
  );
}

const GROUPS: ReadonlyArray<[IssueLinkView['kind'], boolean, string]> = [
  ['blocks', false, 'blocks'],
  ['blocks', true, 'is blocked by'],
  ['relates', false, 'relates to'],
  ['relates', true, 'relates to'],
  ['duplicates', false, 'duplicates'],
  ['duplicates', true, 'is duplicated by'],
];

/** Links grouped as the mock labels them: "blocks", "relates to" and their inverses. */
export function LinkedIssuesSection({ issue, vocabulary, size }: ListProps) {
  if (issue.links.length === 0) return null;
  const labels = [...new Set(GROUPS.map(([, , label]) => label))];
  return (
    <IssueSection heading={<SectionHeading title="Linked issues" size={size} />}>
      <ListCard>
        {labels.map((label) => {
          const links = issue.links.filter((link) =>
            GROUPS.some(
              ([kind, inverse, name]) =>
                name === label && link.kind === kind && link.inverse === inverse,
            ),
          );
          if (links.length === 0) return null;
          return [
            <ListGroupLabel key={label}>{label}</ListGroupLabel>,
            ...links.map((link) => (
              <LinkedIssueRow
                key={link.id}
                href={workPaths.issue(link.issue.key)}
                issueKey={link.issue.key}
                title={link.issue.title}
                type={vocabulary.glyph(link.issue.typeId)}
                status={vocabulary.rowStatus(link.issue.statusId)}
              />
            )),
          ];
        })}
      </ListCard>
    </IssueSection>
  );
}
