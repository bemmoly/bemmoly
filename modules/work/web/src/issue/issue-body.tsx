import type { Comment, IssueDetail, RichText } from '@bemmoly/module-work/shared';
import { Button, Tooltip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { CreateIssueDialog } from '../create/create-issue-dialog.tsx';
import { useCustomFields } from '../hooks/issue-fields.ts';
import { projectKeyOf, useIssueVocabulary } from '../hooks/issue-vocabulary.ts';
import { AcceptanceCriteria } from './acceptance-criteria.tsx';
import { ActivitySection } from './activity-section.tsx';
import { IssueAiSummary } from './issue-ai-summary.tsx';
import { IssueRail } from './issue-rail.tsx';
import { IssueTitle } from './issue-title.tsx';
import { LinksSection } from './links-section.tsx';
import { docToText } from './rich-text-convert.ts';
import { RichTextSection } from './rich-text-section.tsx';
import { SubIssuesSection } from './sub-issues-section.tsx';
import { useIssueEdit } from './use-issue-edit.ts';

export interface IssueBodyProps {
  issue: IssueDetail;
  /** page: the Issue page's main column. panel: the peek, which is narrower. */
  size: 'page' | 'panel';
  /**
   * Draws the rail (status and properties) under the actions, for the peek and for phones,
   * where there is no room beside the text.
   */
  railInline?: boolean;
}

type Creating = { kind: 'subtask'; title?: string } | { kind: 'from-comment'; comment: Comment };

/** The stored key of the acceptance criteria field, drawn as a checklist block. */
const CRITERIA_KEY = 'acceptance_criteria';

/**
 * Everything the Issue page and the peek share, in the review's order: the title, the
 * sub-issue, link and attach actions, the AI summary when AI is on, the description, the
 * acceptance criteria, sub-issues, links and activity.
 */
export function IssueBody({ issue, size, railInline = size === 'panel' }: IssueBodyProps) {
  const [creating, setCreating] = useState<Creating | null>(null);
  const [addingSub, setAddingSub] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const projectKey = projectKeyOf(issue.key);
  const vocabulary = useIssueVocabulary(projectKey, issue.projectId);
  const { edit, save } = useIssueEdit(issue.key);
  const custom = useCustomFields(projectKey, issue.typeId, issue.customFields);
  const canHaveSubtasks = issue.type.level === 'standard';

  const saveDoc = (key: string, what: string) => (doc: RichText | null) =>
    save({ body: { customFields: { ...issue.customFields, [key]: doc } }, what });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <IssueTitle issue={issue} size={size} />
        <div className="-ml-2 flex flex-wrap gap-1">
          {canHaveSubtasks && (
            <Button
              size="xs"
              variant="ghost"
              icon={<Icon name="subtask" size={14} />}
              onClick={() => setAddingSub(true)}
            >
              Add sub-issue
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            icon={<Icon name="link" size={14} />}
            onClick={() => setAddingLink(true)}
          >
            Link
          </Button>
          <Tooltip label="Attachments are not available in this version yet">
            <Button
              size="xs"
              variant="ghost"
              icon={<Icon name="clip" size={14} />}
              aria-disabled
              className="cursor-not-allowed opacity-60"
            >
              Attach
            </Button>
          </Tooltip>
        </div>
      </div>
      {railInline && (
        <div className="rounded-card border border-line bg-canvas px-3.5 pt-3.5 pb-3">
          <IssueRail issue={issue} />
        </div>
      )}
      <IssueAiSummary size={size} />
      <RichTextSection
        title="Description"
        showTitle={false}
        size={size}
        doc={issue.description}
        onSave={(description) => save({ body: { description }, what: 'The description' })}
      />
      {custom.documents.map(({ field }) =>
        field.key === CRITERIA_KEY ? (
          <AcceptanceCriteria
            key={field.id}
            title={field.name}
            doc={issue.customFields[field.key] as RichText | null | undefined}
            onSave={(doc) =>
              edit({
                body: { customFields: { ...issue.customFields, [field.key]: doc } },
                what: field.name,
              })
            }
          />
        ) : (
          <RichTextSection
            key={field.id}
            title={field.name}
            size={size}
            placeholder={`Add ${field.name.toLowerCase()}…`}
            doc={issue.customFields[field.key] as RichText | null | undefined}
            onSave={saveDoc(field.key, field.name)}
          />
        ),
      )}
      {canHaveSubtasks && (
        <SubIssuesSection
          issue={issue}
          vocabulary={vocabulary}
          size={size}
          adding={addingSub}
          onAddingChange={setAddingSub}
          onOpenForm={(title) => setCreating({ kind: 'subtask', title })}
        />
      )}
      <LinksSection
        issue={issue}
        vocabulary={vocabulary}
        size={size}
        adding={addingLink}
        onAddingChange={setAddingLink}
      />
      <ActivitySection
        issue={issue}
        vocabulary={vocabulary}
        size={size}
        onCreateIssue={(comment) => setCreating({ kind: 'from-comment', comment })}
      />
      <CreateIssueDialog
        open={creating !== null}
        onClose={() => setCreating(null)}
        projectKey={projectKey}
        {...(creating?.kind === 'subtask'
          ? {
              parent: { id: issue.id, key: issue.key },
              ...(creating.title ? { initial: { title: creating.title } } : {}),
            }
          : {})}
        {...(creating?.kind === 'from-comment'
          ? { initial: { description: docToText(creating.comment.body) } }
          : {})}
      />
    </div>
  );
}
