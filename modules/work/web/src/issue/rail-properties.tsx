import type { IssueDetail } from '@bemmoly/module-work/shared';
import {
  Label,
  PropertyGroup,
  PropertyRow,
  TypeGlyph,
  useToast,
  type SelectOption,
} from '@bemmoly/ui';
import { useCustomFields } from '../hooks/issue-fields.ts';
import { usePeople, useViewer } from '../hooks/issue-people.ts';
import { projectKeyOf } from '../hooks/issue-vocabulary.ts';
import { useIssueTypes, useLabels } from '../hooks/projects-catalog.ts';
import { CustomFieldValue } from './custom-field-value.tsx';
import { ChoiceField, InlineValue, PersonField, PriorityField } from './field-editors.tsx';
import { useIssueEdit } from './use-issue-edit.ts';
import { typeGlyph } from './vocabulary.ts';

const ASSIGN_ME =
  'cursor-pointer rounded-chip border-0 bg-transparent px-1 py-0.5 font-sans text-12 text-tx-3 hover:text-acc focus-ring';

/**
 * The Properties group: type, assignee (with Assign to me), priority, points, labels and the
 * type's own fields. Every value changes in place and shows the change at once.
 */
export function RailProperties({ issue }: { issue: IssueDetail }) {
  const projectKey = projectKeyOf(issue.key);
  const { edit } = useIssueEdit(issue.key);
  const viewer = useViewer();
  const { person } = usePeople();
  const toast = useToast();
  const types = useIssueTypes(projectKey);
  const labels = useLabels(projectKey);
  const custom = useCustomFields(projectKey, issue.typeId, issue.customFields);

  const typeOptions: SelectOption[] = types.types
    .filter((type) => type.level === issue.type.level)
    .map((type) => ({ value: type.id, label: type.name, icon: <TypeGlyph type={type} /> }));
  const labelOptions = (labels.data ?? [])
    .filter((label) => !issue.labelIds.includes(label.id))
    .map((label) => ({ value: label.id, label: label.name }));

  const setLabels = (ids: string[], what = 'The labels') =>
    edit({
      body: { labelIds: ids },
      shown: {
        labels: ids
          .map(
            (id) =>
              issue.labels.find((label) => label.id === id) ??
              (labels.data ?? []).find((label) => label.id === id),
          )
          .filter((label) => label !== undefined)
          .map((label) => ({ id: label.id, name: label.name, color: label.color ?? null })),
      },
      what,
    });
  const removeLabel = (id: string, name: string) => {
    const before = issue.labelIds;
    setLabels(before.filter((labelId) => labelId !== id));
    toast.undo({ title: `Label ${name} removed`, onUndo: () => setLabels(before) });
  };
  const assign = (assigneeId: string | null, name?: string) =>
    edit({
      body: { assigneeId },
      shown: {
        assignee: assigneeId
          ? { id: assigneeId, name: name ?? person(assigneeId).name, email: '' }
          : null,
      },
      what: 'The assignee',
    });

  return (
    <PropertyGroup title="Properties">
      <PropertyRow label="Type">
        {typeOptions.length > 1 ? (
          <ChoiceField
            label="Type"
            value={issue.typeId}
            options={typeOptions}
            onSave={(typeId) => {
              const next = types.byId.get(typeId ?? '');
              if (!next || next.id === issue.typeId) return;
              edit({
                body: { typeId: next.id },
                shown: {
                  type: {
                    id: next.id,
                    name: next.name,
                    key: next.key,
                    level: next.level,
                    icon: next.icon,
                  },
                },
                what: 'The type',
              });
            }}
          />
        ) : (
          <span className="inline-flex items-center gap-1.75 text-13 text-tx">
            <TypeGlyph type={typeGlyph(issue.type)} />
            {issue.type.name}
          </span>
        )}
      </PropertyRow>
      <PropertyRow label="Assignee">
        <PersonField
          label="Assignee"
          value={issue.assigneeId}
          placeholder="Add assignee"
          {...(issue.assignee ? { currentName: issue.assignee.name } : {})}
          onSave={(id) => assign(id)}
        />
        {viewer && issue.assigneeId !== viewer.id && (
          <button
            type="button"
            className={ASSIGN_ME}
            onClick={() => assign(viewer.id, viewer.name)}
          >
            Assign to me
          </button>
        )}
      </PropertyRow>
      <PropertyRow label="Priority">
        <PriorityField
          value={issue.priority}
          onSave={(priority) => edit({ body: { priority }, what: 'The priority' })}
        />
      </PropertyRow>
      <PropertyRow label="Points">
        <InlineValue
          label="Points"
          type="number"
          mono
          placeholder="Add estimate"
          value={issue.estimate === null ? '' : String(issue.estimate)}
          validate={(next) => (next && !(Number(next) >= 0) ? 'Use a number of 0 or more.' : null)}
          onSave={(next) =>
            edit({ body: { estimate: next === '' ? null : Number(next) }, what: 'The estimate' })
          }
        />
      </PropertyRow>
      <PropertyRow label="Labels">
        {issue.labels.map((label) => (
          <Label
            key={label.id}
            name={label.name}
            color={label.color}
            onRemove={() => removeLabel(label.id, label.name)}
          />
        ))}
        {labelOptions.length > 0 && (
          <ChoiceField
            label="Add a label"
            value={null}
            placeholder={issue.labels.length ? 'Add' : 'Add label'}
            options={labelOptions}
            onSave={(id) => id && setLabels([...issue.labelIds, id])}
          />
        )}
        {labels.isSuccess && labelOptions.length === 0 && issue.labels.length === 0 && (
          <span className="text-13 text-tx-3">No labels in this project</span>
        )}
      </PropertyRow>
      {custom.side.map(({ field }) => (
        <PropertyRow key={field.id} label={field.name}>
          <CustomFieldValue
            field={field}
            value={issue.customFields[field.key]}
            onSave={(value) =>
              edit({
                body: { customFields: { ...issue.customFields, [field.key]: value } },
                what: field.name,
              })
            }
          />
        </PropertyRow>
      ))}
    </PropertyGroup>
  );
}
