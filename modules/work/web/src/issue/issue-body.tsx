import type { Comment, IssueDetail, RichText } from '@bemmoly/module-work/shared';
import { Button } from '@bemmoly/ui';
import { useState } from 'react';
import { CreateIssueDialog } from '../create/create-issue-dialog.tsx';
import { useUpdateIssue } from '../hooks/issue-detail.ts';
import { useCustomFields } from '../hooks/issue-fields.ts';
import { projectKeyOf, useIssueVocabulary } from '../hooks/issue-vocabulary.ts';
import { ActivitySection } from './activity-section.tsx';
import { DetailsCard } from './details-card.tsx';
import { LinkedIssuesSection, SubtasksSection } from './issue-lists.tsx';
import { IssueTitle, SummaryPlaceholder } from './issue-title.tsx';
import { LinkIssueDialog } from './link-issue-dialog.tsx';
import { docToText } from './rich-text-convert.ts';
import { RichTextSection } from './rich-text-section.tsx';
import { StatusMenu } from './status-menu.tsx';

export interface IssueBodyProps {
  issue: IssueDetail;
  /** page: the Issue page's main column. panel: the slide-over, Details included. */
  size: 'page' | 'panel';
}

type Creating = { kind: 'subtask' } | { kind: 'from-comment'; comment: Comment } | null;

/**
 * Everything the Issue page and the slide-over share, in the mock's order: title, status and
 * actions, the AI summary, description and the rich text fields, subtasks, links, activity.
 */
export function IssueBody({ issue, size }: IssueBodyProps) {
  const [linking, setLinking] = useState(false);
  const [creating, setCreating] = useState<Creating>(null);
  const projectKey = projectKeyOf(issue.key);
  const vocabulary = useIssueVocabulary(projectKey, issue.projectId);
  const update = useUpdateIssue(issue.key);
  const custom = useCustomFields(projectKey, issue.typeId, issue.customFields);
  const page = size === 'page';
  const canHaveSubtasks = issue.type.level === 'standard';

  const saveCustom = (key: string) => (doc: RichText | null) =>
    update.mutateAsync({ customFields: { ...issue.customFields, [key]: doc } });

  return (
    <>
      <IssueTitle issue={issue} size={size} />
      <div className="flex flex-wrap gap-1.5">
        <StatusMenu issue={issue} size={page ? 'xl' : 'lg'} />
        {canHaveSubtasks && (
          <Button size={page ? 'md' : 'sm'} onClick={() => setCreating({ kind: 'subtask' })}>
            {page ? 'Create subtask' : 'Subtask'}
          </Button>
        )}
        <Button size={page ? 'md' : 'sm'} onClick={() => setLinking(true)}>
          Link issue
        </Button>
      </div>
      <SummaryPlaceholder size={size} />
      <RichTextSection
        title="Description"
        size={size}
        doc={issue.description}
        onSave={(description) => update.mutateAsync({ description })}
      />
      {custom.documents.map(({ field }) => (
        <RichTextSection
          key={field.id}
          title={field.name}
          size={size}
          doc={issue.customFields[field.key] as RichText | null | undefined}
          onSave={saveCustom(field.key)}
        />
      ))}
      {!page && <DetailsCard issue={issue} size="panel" />}
      <SubtasksSection issue={issue} vocabulary={vocabulary} size={size} />
      <LinkedIssuesSection issue={issue} vocabulary={vocabulary} size={size} />
      <ActivitySection
        issue={issue}
        vocabulary={vocabulary}
        size={size}
        onCreateIssue={(comment) => setCreating({ kind: 'from-comment', comment })}
      />
      <LinkIssueDialog issueKey={issue.key} open={linking} onClose={() => setLinking(false)} />
      <CreateIssueDialog
        open={creating !== null}
        onClose={() => setCreating(null)}
        projectKey={projectKey}
        {...(creating?.kind === 'subtask' ? { parent: { id: issue.id, key: issue.key } } : {})}
        {...(creating?.kind === 'from-comment'
          ? { initial: { description: docToText(creating.comment.body) } }
          : {})}
      />
    </>
  );
}
