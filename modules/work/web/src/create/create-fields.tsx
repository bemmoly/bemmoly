import type { Field as FieldDef } from '@bemmoly/module-work/shared';
import {
  Avatar,
  Field,
  FormGrid,
  FormGridItem,
  Input,
  PRIORITIES,
  PriorityGlyph,
  RequiredMark,
  Select,
  Textarea,
  type Priority,
  type SelectOption,
} from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { DEFAULT_FIELDS, type CreateDraft, type useCreateIssue } from '../hooks/create-issue.ts';
import { personOption, usePeople } from '../hooks/issue-people.ts';
import { useLabels, useSprints, useVersions } from '../hooks/projects-catalog.ts';

type Form = ReturnType<typeof useCreateIssue>;

const LABELS: Record<(typeof DEFAULT_FIELDS)[number], string> = {
  assigneeId: 'Assignee',
  priority: 'Priority',
  labelIds: 'Labels',
  estimate: 'Story points',
  sprintId: 'Sprint',
  fixVersionId: 'Fix version',
};

const PRIORITY_OPTIONS: SelectOption[] = (Object.keys(PRIORITIES) as Priority[]).map((key) => ({
  value: key,
  label: PRIORITIES[key].name,
  icon: <PriorityGlyph priority={key} />,
}));

const withNone = (label: string, options: SelectOption[]) => [{ value: '', label }, ...options];
const label = (text: string, required: boolean): ReactNode => (
  <>
    {text}
    {required && <RequiredMark />}
  </>
);

/** The fields under title and description: the built-ins, then the type's custom fields. */
export function CreateFields({ form }: { form: Form }) {
  const { draft, set, setCustom, errors, layout, projectKey } = form;
  const { people, loadOptions } = usePeople();
  const labels = useLabels(projectKey);
  const sprints = useSprints(projectKey);
  const versions = useVersions(projectKey);
  const required = (column: string) =>
    layout.rows.some((row) => row.column === column && row.required);
  const custom = layout.rows.filter((row) => row.column === null);
  const personOptions = people.filter((user) => user.status === 'active').map(personOption);

  const builtIn = (column: (typeof DEFAULT_FIELDS)[number]): ReactNode => {
    const common = { label: label(LABELS[column], required(column)), error: errors[column] };
    switch (column) {
      case 'assigneeId':
        return (
          <Field {...common}>
            <Select
              value={draft.assigneeId ?? ''}
              options={withNone('Unassigned', personOptions).map((option) =>
                option.value
                  ? { ...option, icon: <Avatar name={option.label} size={20} /> }
                  : option,
              )}
              loadOptions={loadOptions}
              onChange={(event) => set('assigneeId', event.value || null)}
            />
          </Field>
        );
      case 'priority':
        return (
          <Field {...common}>
            <Select
              value={draft.priority}
              options={PRIORITY_OPTIONS}
              onChange={(event) => set('priority', event.value as CreateDraft['priority'])}
            />
          </Field>
        );
      case 'labelIds':
        return (
          <Field {...common} hint={labels.isError ? 'Labels are not available yet.' : undefined}>
            <Select
              value={draft.labelIds[0] ?? ''}
              disabled={!labels.isSuccess}
              options={withNone(
                'No label',
                (labels.data ?? []).map((row) => ({ value: row.id, label: row.name })),
              )}
              onChange={(event) => set('labelIds', event.value ? [event.value] : [])}
            />
          </Field>
        );
      case 'estimate':
        return (
          <Field {...common}>
            <Input
              type="number"
              min={0}
              mono
              value={draft.estimate}
              onChange={(event) => set('estimate', event.target.value)}
            />
          </Field>
        );
      case 'sprintId':
      case 'fixVersionId': {
        const source = column === 'sprintId' ? sprints : versions;
        const rows = (source.data ?? []) as Array<{ id: string; name: string }>;
        return (
          <Field {...common}>
            <Select
              value={draft[column] ?? ''}
              disabled={!source.isSuccess}
              options={withNone(
                column === 'sprintId' ? 'Backlog' : 'None',
                rows.map((row) => ({ value: row.id, label: row.name })),
              )}
              onChange={(event) => set(column, event.value || null)}
            />
          </Field>
        );
      }
    }
  };

  return (
    <FormGrid columns={2}>
      {DEFAULT_FIELDS.map((column) => (
        <FormGridItem key={column}>{builtIn(column)}</FormGridItem>
      ))}
      {custom.map(({ field, required: must }) => (
        <FormGridItem key={field.id} full={field.kind === 'richtext'}>
          <CustomInput
            field={field}
            label={label(field.name, must)}
            error={errors[`customFields.${field.key}`]}
            value={draft.custom[field.key]}
            people={personOptions}
            onChange={(value) => setCustom(field.key, value)}
          />
        </FormGridItem>
      ))}
    </FormGrid>
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
  const select = (options: SelectOption[]) => (
    <Field label={text} error={error}>
      <Select
        value={current}
        options={withNone('None', options)}
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
    case 'richtext':
      return (
        <Field label={text} error={error} hint="Blank line between paragraphs, “- ” for a bullet.">
          <Textarea rows={4} value={current} onChange={(event) => onChange(event.target.value)} />
        </Field>
      );
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
