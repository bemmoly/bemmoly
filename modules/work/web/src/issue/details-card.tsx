import type { IssueDetail, UpdateIssueBody } from '@bemmoly/module-work/shared';
import {
  Card,
  CardHeader,
  FieldList,
  FieldPerson,
  FieldRow,
  FieldSwatch,
  Tag,
  useToast,
  WatcherList,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useWatchers } from '../hooks/issue-activity.ts';
import { useUpdateIssue } from '../hooks/issue-detail.ts';
import { useCustomFields } from '../hooks/issue-fields.ts';
import { linkTo, workPaths } from '../hooks/issue-navigation.ts';
import { usePeople } from '../hooks/issue-people.ts';
import { projectKeyOf } from '../hooks/issue-vocabulary.ts';
import { useLabels, useSprints, useVersions } from '../hooks/projects-catalog.ts';
import { cx } from './cx.ts';
import { CustomFieldValue } from './custom-field-value.tsx';
import { ChoiceField, InlineValue, PersonField, PriorityField } from './field-editors.tsx';
import { formatDay } from './vocabulary.ts';

export interface DetailsCardProps {
  issue: IssueDetail;
  size: 'page' | 'panel';
}

const today = () => new Date().toISOString().slice(0, 10);

/** Details: every field of the issue as label and value, each edited in place. */
export function DetailsCard({ issue, size }: DetailsCardProps) {
  const [open, setOpen] = useState(true);
  const projectKey = projectKeyOf(issue.key);
  const update = useUpdateIssue(issue.key);
  const toast = useToast();
  const { person } = usePeople();
  const labels = useLabels(projectKey);
  const versions = useVersions(projectKey);
  const sprints = useSprints(projectKey);
  const watchers = useWatchers(issue.key);
  const custom = useCustomFields(projectKey, issue.typeId, issue.customFields);

  const save = (body: UpdateIssueBody, what: string) =>
    update.mutate(body, {
      onError: (error) =>
        toast.show({ tone: 'danger', title: `${what} was not saved`, body: error.message }),
    });
  const saveCustom = (key: string, value: unknown) =>
    save({ customFields: { ...issue.customFields, [key]: value } }, 'The field');

  const overdue = issue.dueAt && issue.dueAt < today() && issue.status.category !== 'done';
  const labelOptions = (labels.data ?? [])
    .filter((label) => !issue.labelIds.includes(label.id))
    .map((label) => ({ value: label.id, label: label.name }));

  return (
    <Card radius={size === 'page' ? 'card' : 'panel'}>
      <CardHeader
        title="Details"
        subtle
        actions={
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? 'Hide details' : 'Show details'}
            onClick={() => setOpen(!open)}
            className="flex cursor-pointer border-0 bg-transparent p-0 text-tx5 hover:text-tx2"
          >
            <Icon name={open ? 'caret-up' : 'caret'} size={14} />
          </button>
        }
      />
      {open && (
        <FieldList size={size}>
          <FieldRow label="Assignee">
            <PersonField
              label="Assignee"
              value={issue.assigneeId}
              onSave={(assigneeId) => save({ assigneeId }, 'The assignee')}
            />
          </FieldRow>
          <FieldRow label="Reporter">
            {issue.reporter ? <FieldPerson name={issue.reporter.name} /> : <span>—</span>}
          </FieldRow>
          <FieldRow label="Priority">
            <PriorityField
              value={issue.priority}
              onSave={(priority) => save({ priority }, 'The priority')}
            />
          </FieldRow>
          <FieldRow label="Story points">
            <InlineValue
              label="Story points"
              type="number"
              mono
              value={issue.estimate === null ? '' : String(issue.estimate)}
              validate={(next) =>
                next && !(Number(next) >= 0) ? 'Use a number of 0 or more.' : null
              }
              onSave={(next) =>
                save({ estimate: next === '' ? null : Number(next) }, 'The estimate')
              }
            />
          </FieldRow>
          <FieldRow label="Sprint">
            {sprints.isSuccess ? (
              <ChoiceField
                label="Sprint"
                value={issue.sprintId}
                noneLabel="Backlog"
                options={sprints.data
                  .filter((sprint) => sprint.state !== 'closed' || sprint.id === issue.sprintId)
                  .map((sprint) => ({ value: sprint.id, label: sprint.name }))}
                onSave={(sprintId) => save({ sprintId }, 'The sprint')}
              />
            ) : (
              <span className={cx(!issue.sprint && 'text-tx5')}>
                {issue.sprint?.name ?? 'Backlog'}
              </span>
            )}
          </FieldRow>
          {issue.parent && (
            <FieldRow label={issue.type.level === 'subtask' ? 'Parent' : 'Epic'}>
              <FieldSwatch colorClassName="bg-ac" />
              <a {...linkTo(workPaths.issue(issue.parent.key))} className="text-tx">
                {issue.parent.title}
              </a>
            </FieldRow>
          )}
          <FieldRow label="Labels" className="gap-1">
            {issue.labels.map((label) => (
              <Tag
                key={label.id}
                onRemove={() =>
                  save({ labelIds: issue.labelIds.filter((id) => id !== label.id) }, 'The labels')
                }
                removeLabel={`Remove label ${label.name}`}
              >
                {label.name}
              </Tag>
            ))}
            {labels.isSuccess && labelOptions.length > 0 && (
              <ChoiceField
                label="Add a label"
                value={null}
                noneLabel={issue.labels.length ? 'Add' : 'None'}
                options={labelOptions}
                onSave={(id) => id && save({ labelIds: [...issue.labelIds, id] }, 'The labels')}
              />
            )}
            {!labels.isSuccess && issue.labels.length === 0 && (
              <span className="text-tx5">None</span>
            )}
          </FieldRow>
          <FieldRow label="Fix version">
            {versions.isSuccess ? (
              <ChoiceField
                label="Fix version"
                value={issue.fixVersionId}
                options={versions.data
                  .filter(
                    (version) =>
                      version.status === 'unreleased' || version.id === issue.fixVersionId,
                  )
                  .map((version) => ({ value: version.id, label: version.name }))}
                onSave={(fixVersionId) => save({ fixVersionId }, 'The fix version')}
              />
            ) : (
              <span className={cx(!issue.fixVersion && 'text-tx5')}>
                {issue.fixVersion?.name ?? 'None'}
              </span>
            )}
          </FieldRow>
          <FieldRow label="Due date">
            <InlineValue
              label="Due date"
              type="date"
              value={issue.dueAt ?? ''}
              display={
                issue.dueAt ? (
                  <span className={cx(overdue && 'text-warn-fg')}>{formatDay(issue.dueAt)}</span>
                ) : null
              }
              onSave={(next) => save({ dueAt: next || null }, 'The due date')}
            />
          </FieldRow>
          {custom.side.map(({ field }) => (
            <FieldRow key={field.id} label={field.name}>
              <CustomFieldValue
                field={field}
                value={issue.customFields[field.key]}
                onSave={(value) => saveCustom(field.key, value)}
              />
            </FieldRow>
          ))}
          <FieldRow label="Watchers">
            <WatcherList
              people={(watchers.data ?? []).slice(0, 3).map((row) => ({
                name: person(row.userId).name,
              }))}
              total={issue.watchersCount}
            />
          </FieldRow>
        </FieldList>
      )}
    </Card>
  );
}
