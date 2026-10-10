import type { Field as FieldDef } from '@bemmoly/module-work/shared';
import {
  Avatar,
  epicColor,
  epicFill,
  Field,
  FormGrid,
  FormGridItem,
  Input,
  PRIORITIES,
  PriorityGlyph,
  RequiredMark,
  Select,
  StatusGlyph,
  statusStage,
  type Priority,
  type SelectOption,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState, type ReactNode } from 'react';
import type { CreateDraft, useCreateIssue } from '../hooks/create-issue.ts';
import type { CreateOptions } from '../hooks/create-options.ts';
import { personOption, usePeople } from '../hooks/issue-people.ts';
import { cx } from '../issue/cx.ts';
import { useVersions } from '../hooks/projects-catalog.ts';
import { ChipMore, ChipMulti, ChipNumber, ChipSelect } from './create-chips.tsx';

type Form = ReturnType<typeof useCreateIssue>;

const PRIORITY_OPTIONS: SelectOption[] = (Object.keys(PRIORITIES) as Priority[]).map((key) => ({
  value: key,
  label: PRIORITIES[key].name,
  icon: <PriorityGlyph priority={key} />,
}));

/** A square of the epic's stored colour, the same one the Board, Backlog and Issue paint. */
const epicSwatch = (epic: { id: string; color?: string | null } | null) => (
  <i
    aria-hidden
    className={cx(
      'inline-block size-2.25 rounded-tick',
      epicFill(epic ? epicColor(epic.color, epic.id) : null),
    )}
  />
);

/**
 * The properties under the text, as chips: status, priority, assignee, labels, sprint,
 * points and epic, each starting from where the person opened the form. ··· shows the
 * rest of the type's fields; a required one, or one with an error, is always shown.
 */
export function CreateFields({ form, options }: { form: Form; options: CreateOptions }) {
  const { draft, set, setCustom, errors, layout } = form;
  const { people, loadOptions } = usePeople();
  const versions = useVersions(form.projectKey);
  const [more, setMore] = useState(false);
  const personOptions = people
    .filter((user) => user.status === 'active')
    .map((user) => ({ ...personOption(user), icon: <Avatar name={user.name} size={16} /> }));
  const subtask = Boolean(draft.parentId) && !options.epics.some((e) => e.id === draft.parentId);

  const extra = layout.rows.filter((row) => row.column === null && row.field.kind !== 'richtext');
  const shown = extra.filter(
    (row) => more || row.required || errors[`customFields.${row.field.key}`],
  );
  const showVersion = more || Boolean(draft.fixVersionId) || Boolean(errors['fixVersionId']);
  const hidden = extra.length - shown.length + (showVersion ? 0 : 1);

  const status = draft.statusId ?? options.initial?.id ?? null;
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Properties" className="flex flex-wrap items-center gap-1.5">
        <ChipSelect
          name="Status"
          value={status}
          options={options.statuses.map((s) => ({
            value: s.id,
            label: s.name,
            icon: <StatusGlyph stage={statusStage(s.category, s.name)} size={14} />,
          }))}
          onChange={(value) => set('statusId', value)}
        />
        <ChipSelect
          name="Priority"
          value={draft.priority}
          options={PRIORITY_OPTIONS}
          invalid={Boolean(errors['priority'])}
          onChange={(value) => set('priority', (value ?? 'medium') as CreateDraft['priority'])}
        />
        <ChipSelect
          name="Assignee"
          value={draft.assigneeId}
          options={personOptions}
          loadOptions={loadOptions}
          noneLabel="Unassigned"
          emptyIcon={<Icon name="user" size={14} />}
          invalid={Boolean(errors['assigneeId'])}
          onChange={(value) => set('assigneeId', value)}
        />
        <ChipMulti
          name="Labels"
          values={draft.labelIds}
          options={options.labels.map((row) => ({ value: row.id, label: row.name }))}
          icon={<Icon name="tag" size={14} />}
          invalid={Boolean(errors['labelIds'])}
          onChange={(value) => set('labelIds', value)}
        />
        {options.sprints.length > 0 && (
          <ChipSelect
            name="Sprint"
            value={draft.sprintId}
            options={options.sprints.map((sprint) => ({
              value: sprint.id,
              label: sprint.name,
              icon: <Icon name="target" size={14} />,
            }))}
            noneLabel="Backlog"
            emptyIcon={<Icon name="target" size={14} />}
            invalid={Boolean(errors['sprintId'])}
            onChange={(value) => set('sprintId', value)}
          />
        )}
        <ChipNumber
          name="Story points"
          value={draft.estimate}
          invalid={Boolean(errors['estimate'])}
          onChange={(value) => set('estimate', value)}
        />
        {!subtask && options.epics.length > 0 && (
          <ChipSelect
            name="Epic"
            value={draft.parentId}
            options={options.epics.map((epic) => ({
              value: epic.id,
              label: epic.title,
              description: epic.key,
              icon: epicSwatch(epic),
            }))}
            noneLabel="No epic"
            emptyIcon={epicSwatch(null)}
            invalid={Boolean(errors['parentId'])}
            onChange={(value) => set('parentId', value)}
          />
        )}
        {(hidden > 0 || more) && (
          <ChipMore open={more} count={hidden} onToggle={() => setMore((value) => !value)} />
        )}
      </div>
      <ChipErrors errors={errors} />
      {(shown.length > 0 || showVersion) && (
        <FormGrid columns={2}>
          {showVersion && (
            <FormGridItem>
              <Field label="Fix version" error={errors['fixVersionId']}>
                <Select
                  value={draft.fixVersionId ?? ''}
                  disabled={!versions.isSuccess}
                  options={[
                    { value: '', label: 'None' },
                    ...(versions.data ?? []).map((row) => ({ value: row.id, label: row.name })),
                  ]}
                  onChange={(event) => set('fixVersionId', event.value || null)}
                />
              </Field>
            </FormGridItem>
          )}
          {shown.map(({ field, required }) => (
            <FormGridItem key={field.id}>
              <CustomInput
                field={field}
                label={
                  <>
                    {field.name}
                    {required && <RequiredMark />}
                  </>
                }
                error={errors[`customFields.${field.key}`]}
                value={draft.custom[field.key]}
                people={personOptions}
                onChange={(value) => setCustom(field.key, value)}
              />
            </FormGridItem>
          ))}
        </FormGrid>
      )}
    </div>
  );
}

const CHIP_NAMES: Record<string, string> = {
  statusId: 'Status',
  priority: 'Priority',
  assigneeId: 'Assignee',
  labelIds: 'Labels',
  sprintId: 'Sprint',
  estimate: 'Story points',
  parentId: 'Epic',
};

/** A chip has no room under it, so its problem is spelled out beneath the row. */
function ChipErrors({ errors }: { errors: Record<string, string> }) {
  const found = Object.keys(CHIP_NAMES).filter((key) => errors[key]);
  if (found.length === 0) return null;
  return (
    <ul role="alert" className="m-0 flex list-none flex-col gap-0.5 p-0 text-12 text-red-tx">
      {found.map((key) => (
        <li key={key}>{errors[key]}</li>
      ))}
    </ul>
  );
}

interface CustomInputProps {
  field: FieldDef;
  label: ReactNode;
  error: string | undefined;
  value: unknown;
  people: SelectOption[];
  onChange: (value: unknown) => void;
}

/** One custom field as a form control, by its kind. */
function CustomInput({ field, label: text, error, value, people, onChange }: CustomInputProps) {
  const single = Array.isArray(value) ? value[0] : value;
  const current = typeof single === 'string' || typeof single === 'number' ? String(single) : '';
  const many = field.kind === 'multiselect';
  const select = (choices: SelectOption[]) => (
    <Field label={text} error={error}>
      <Select
        value={current}
        options={[{ value: '', label: 'None' }, ...choices]}
        onChange={(event) => onChange(event.value ? (many ? [event.value] : event.value) : null)}
      />
    </Field>
  );
  switch (field.kind) {
    case 'select':
    case 'multiselect':
      return select(field.options.map((option) => ({ value: option.value, label: option.label })));
    case 'user':
      return select(people);
    default: {
      const type = { number: 'number', date: 'date', datetime: 'datetime-local', url: 'url' }[
        field.kind as string
      ];
      return (
        <Field label={text} error={error}>
          <Input
            type={type ?? 'text'}
            value={current}
            onChange={(event) =>
              onChange(
                field.kind === 'number' && event.target.value
                  ? Number(event.target.value)
                  : event.target.value,
              )
            }
          />
        </Field>
      );
    }
  }
}
