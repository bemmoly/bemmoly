import type { IssueDetail } from '@bemmoly/module-work/shared';
import { EmptyHint, ListCard, ProgressBar, SectionHeading, SubtaskRow, useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSubtasks } from '../hooks/issue-detail.ts';
import { workPaths } from '../hooks/issue-navigation.ts';
import { usePeople } from '../hooks/issue-people.ts';
import type { IssueVocabulary } from '../hooks/issue-vocabulary.ts';
import { projectKeyOf } from '../hooks/issue-vocabulary.ts';
import { useIssueTypes } from '../hooks/projects-catalog.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';
import { InlineAdd } from './inline-add.tsx';

export interface SubIssuesSectionProps {
  issue: IssueDetail;
  vocabulary: IssueVocabulary;
  size: 'page' | 'panel';
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
  /** Opens the full create form with this title, for a type whose required fields need it. */
  onOpenForm: (title: string) => void;
}

/**
 * Sub-issues, always shown on an issue that can have them: "2 of 4 done", the progress bar,
 * one row per sub-issue, and "Add sub-issue" in place, which creates on Enter.
 */
export function SubIssuesSection({
  issue,
  vocabulary,
  size,
  adding,
  onAddingChange,
  onOpenForm,
}: SubIssuesSectionProps) {
  const rows = useSubtasks(issue.id).data ?? issue.subtasks;
  const { person } = usePeople();
  const types = useIssueTypes(projectKeyOf(issue.key));
  const subtaskType = types.types.find((type) => type.level === 'subtask');
  const queryClient = useQueryClient();
  const toast = useToast();
  const create = useMutation({
    mutationFn: (title: string) =>
      api.work.issues.create({
        projectId: issue.projectId,
        typeId: subtaskType?.id ?? '',
        title,
        parentId: issue.id,
        priority: 'medium',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workKeys.all() }),
  });

  const add = (title: string) =>
    create.mutateAsync(title).catch((error: Error) => {
      toast.show({
        tone: 'danger',
        title: 'The sub-issue was not created',
        body: error.message,
        action: { label: 'Open the full form', onClick: () => onOpenForm(title) },
      });
      throw error;
    });

  const done = rows.filter((row) => vocabulary.rowStatus(row.statusId).done).length;
  return (
    <section aria-label="Sub-issues" className="flex flex-col gap-2">
      <SectionHeading
        title="Sub-issues"
        size={size}
        {...(rows.length > 0 ? { hint: `${done} of ${rows.length} done` } : {})}
      />
      {rows.length > 0 && (
        <ProgressBar value={(done / rows.length) * 100} size="xs" label="Sub-issues done" />
      )}
      {rows.length === 0 && !adding && (
        <EmptyHint>Break the work into steps someone can pick up.</EmptyHint>
      )}
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
        <InlineAdd
          label="Add sub-issue"
          placeholder="Sub-issue title, then Enter"
          open={adding}
          onOpenChange={onAddingChange}
          onSubmit={add}
        />
      </ListCard>
    </section>
  );
}
