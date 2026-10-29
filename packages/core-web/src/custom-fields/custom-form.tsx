import type { CustomFieldDefinition } from '@bemmoly/shared';
import {
  CustomFieldControl,
  FormSections,
  type CustomFieldControlSpec,
  type LoadOptions,
  type SelectOption,
} from '@bemmoly/ui';
import type { ReactNode } from 'react';
import type { CustomFormState } from './use-custom-form.ts';

export const controlSpecOf = (field: CustomFieldDefinition): CustomFieldControlSpec => ({
  key: field.key,
  label: field.label,
  kind: field.kind,
  description: field.description,
  required: field.required,
  options: field.options,
  ...(field.validation.currency ? { currency: field.validation.currency } : {}),
  ...(field.validation.decimals !== undefined ? { decimals: field.validation.decimals } : {}),
});

export interface CustomFormProps {
  state: CustomFormState;
  fields: readonly CustomFieldDefinition[];
  /** Keys the viewer may see but not change; the kernel refuses such writes anyway. */
  readOnlyKeys?: ReadonlySet<string>;
  loadPeople?: LoadOptions;
  loadFiles?: LoadOptions;
  knownOptions?: readonly SelectOption[];
  /** The buttons under the form; the primary one submits. */
  actions: ReactNode;
  'aria-label': string;
}

/** A custom form bound to its definitions: shown sections, controls and the submit. */
export function CustomForm({
  state,
  fields,
  readOnlyKeys,
  actions,
  'aria-label': label,
  ...pickers
}: CustomFormProps) {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const sections = state.sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    columns: section.columns,
    items: section.items.flatMap((item) => {
      const field = byKey.get(item.field);
      if (!field) return [];
      return [
        {
          key: field.key,
          full: item.full,
          node: (
            <CustomFieldControl
              field={controlSpecOf(field)}
              value={state.values[field.key] ?? null}
              error={state.errors[field.key]}
              disabled={state.submitting || readOnlyKeys?.has(field.key) === true}
              onChange={(value) => state.setValue(field.key, value)}
              {...pickers}
            />
          ),
        },
      ];
    }),
  }));
  return (
    <form
      aria-label={label}
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void state.submit();
      }}
    >
      <FormSections sections={sections} />
      <div className="flex justify-end gap-2">{actions}</div>
    </form>
  );
}
