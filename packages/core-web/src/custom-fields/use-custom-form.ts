import { fieldErrors } from '@bemmoly/api-client';
import {
  validateFieldValues,
  visibleFieldKeys,
  visibleSections,
  type CustomFieldDefinition,
  type CustomForm,
  type FieldValues,
  type FormLayout,
} from '@bemmoly/shared';
import { useMemo, useState } from 'react';

export interface UseCustomFormOptions {
  form: Pick<CustomForm, 'sections'>;
  fields: readonly CustomFieldDefinition[];
  initialValues?: FieldValues;
  /** Sends the shown, validated values; a `validation_failed` answer lands under its fields. */
  onSubmit: (values: FieldValues) => Promise<void>;
}

export interface CustomFormState {
  values: FieldValues;
  setValue: (key: string, value: unknown) => void;
  /** The sections and items shown for the current values. */
  sections: FormLayout;
  errors: Record<string, string>;
  submitting: boolean;
  submit: () => Promise<boolean>;
}

const defaultsOf = (fields: readonly CustomFieldDefinition[]) =>
  Object.fromEntries(
    fields.filter((field) => field.defaultValue !== null).map((f) => [f.key, f.defaultValue]),
  );

/**
 * A form's state: values with defaults, the shown sections, and the same validation the
 * kernel runs (ADR 0052), so a person sees every problem before anything is sent.
 */
export function useCustomForm({
  form,
  fields,
  initialValues,
  onSubmit,
}: UseCustomFormOptions): CustomFormState {
  const [values, setValues] = useState<FieldValues>(() => ({
    ...defaultsOf(fields),
    ...initialValues,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const sections = useMemo(() => {
    const shown = visibleFieldKeys(form.sections, values);
    return visibleSections(form.sections, values)
      .map((section) => ({ ...section, items: section.items.filter((i) => shown.has(i.field)) }))
      .filter((section) => section.items.length > 0);
  }, [form.sections, values]);

  function setValue(key: string, value: unknown) {
    setValues((all) => ({ ...all, [key]: value }));
    setErrors(({ [key]: _cleared, ...rest }) => rest);
  }

  async function submit(): Promise<boolean> {
    const shown = visibleFieldKeys(form.sections, values);
    const sent = Object.fromEntries(Object.entries(values).filter(([key]) => shown.has(key)));
    const result = validateFieldValues(fields, sent, { mode: 'create', only: shown });
    if (!result.ok) {
      setErrors(Object.fromEntries(result.issues.map((issue) => [issue.key, issue.message])));
      return false;
    }
    setSubmitting(true);
    try {
      await onSubmit(result.values);
      setErrors({});
      return true;
    } catch (error) {
      const byField = fieldErrors(error);
      if (Object.keys(byField).length === 0) throw error;
      setErrors(byField);
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { values, setValue, sections, errors, submitting, submit };
}
