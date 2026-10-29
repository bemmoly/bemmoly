import {
  ConflictError,
  createCustomFormBodySchema,
  CUSTOM_FORM_SUBMITTED_EVENT,
  NotFoundError,
  submitCustomFormBodySchema,
  ValidationError,
  visibleFieldKeys,
  validateFieldValues,
  type CreateCustomFormBody,
  type CustomForm,
  type CustomFormSubmission,
  type CustomFormSubmittedPayload,
  type FieldScope,
  type SubmitCustomFormBody,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import {
  CUSTOM_FIELDS_CAPABILITY,
  definitionsOf,
  userIdOf,
  WORKSPACE,
  type CustomFieldsDeps,
} from './context.ts';
import { assertEditable, invalid, type createValuesService } from './values.ts';

interface FormRow {
  id: string;
  module_id: string;
  entity_type: string;
  key: string;
  title: string;
  description: string;
  sections: CustomForm['sections'];
  archived_at: Date | null;
}

const toForm = (row: FormRow): CustomForm => ({
  id: row.id,
  moduleId: row.module_id,
  entityType: row.entity_type,
  key: row.key,
  title: row.title,
  description: row.description,
  sections: row.sections,
  archived: row.archived_at !== null,
});

export function createFormsService(
  deps: CustomFieldsDeps,
  values: ReturnType<typeof createValuesService>,
) {
  const { sql } = deps;

  async function get(moduleId: string, key: string): Promise<CustomForm> {
    const [row] = await sql<FormRow[]>`
      select * from custom_forms where module_id = ${moduleId} and key = ${key}`;
    if (!row) throw new NotFoundError('That form does not exist');
    return toForm(row);
  }

  async function create(actor: Actor, body: CreateCustomFormBody): Promise<CustomForm> {
    await deps.authorize(actor, CUSTOM_FIELDS_CAPABILITY, WORKSPACE);
    const input = createCustomFormBodySchema.parse(body);
    const known = new Set((await definitionsOf(sql, input)).map((field) => field.key));
    const missing = input.sections
      .flatMap((section) => section.items.map((item) => item.field))
      .filter((key) => !known.has(key));
    if (missing.length > 0)
      throw new ValidationError(`The form names fields that do not exist: ${missing.join(', ')}`);
    return sql.begin(async (tx) => {
      const [row] = await tx<FormRow[]>`
        insert into custom_forms (module_id, entity_type, key, title, description, sections,
          created_by)
        values (${input.moduleId}, ${input.entityType}, ${input.key}, ${input.title},
          ${input.description}, ${JSON.stringify(input.sections)}::jsonb, ${userIdOf(actor)})
        on conflict (module_id, key) do nothing returning *`;
      if (!row) throw new ConflictError(`A form with the key ${input.key} already exists`);
      const form = toForm(row);
      await deps.audit.record(
        {
          actor,
          action: 'custom_form.created',
          target: { kind: 'custom_form', id: form.id },
          after: form,
        },
        tx,
      );
      return form;
    }) as Promise<CustomForm>;
  }

  /**
   * Validates the shown fields only, stores the submission, writes the values onto the entity
   * when one is given, and publishes `custom_form.submitted` in the same transaction, so a
   * subscriber such as the approval engine commits or rolls back with it. The caller has
   * already decided the actor may submit this form for that entity.
   */
  async function submit(
    actor: Actor,
    moduleId: string,
    key: string,
    body: SubmitCustomFormBody,
  ): Promise<CustomFormSubmission> {
    const input = submitCustomFormBodySchema.parse(body);
    const form = await get(moduleId, key);
    if (form.archived) throw new ConflictError('This form is closed');
    const scope: FieldScope = { moduleId: form.moduleId, entityType: form.entityType };
    const shown = visibleFieldKeys(form.sections, input.values);
    const submitted = Object.fromEntries(
      Object.entries(input.values).filter(([field]) => shown.has(field)),
    );
    return sql.begin(async (tx) => {
      let clean;
      if (input.entityId) {
        clean = await values.write(actor, scope, input.entityId, submitted, {
          mode: 'create',
          transaction: tx,
          only: shown,
        });
      } else {
        const fields = await definitionsOf(tx, scope);
        await assertEditable(tx, actor, fields, submitted);
        const result = validateFieldValues(fields, submitted, { mode: 'create', only: shown });
        if (!result.ok) invalid(result.issues);
        clean = result.values;
      }
      const [row] = await tx<{ id: string; created_at: Date | string }[]>`
        insert into custom_form_submissions (form_id, entity_id, submitted_by, values)
        values (${form.id}, ${input.entityId ?? null}, ${userIdOf(actor)},
          ${JSON.stringify(clean)}::jsonb)
        returning id, created_at`;
      const submission: CustomFormSubmission = {
        id: row!.id,
        formId: form.id,
        entityId: input.entityId ?? null,
        submittedBy: userIdOf(actor),
        values: clean,
        createdAt: new Date(row!.created_at).toISOString(),
      };
      const payload: CustomFormSubmittedPayload = {
        submissionId: submission.id,
        formId: form.id,
        formKey: form.key,
        moduleId: form.moduleId,
        entityType: form.entityType,
        entityId: submission.entityId,
        values: clean,
      };
      await deps.events.publish({
        kind: CUSTOM_FORM_SUBMITTED_EVENT,
        occurredAt: new Date(),
        actor,
        entity: { kind: 'custom_form_submission', id: submission.id },
        payload,
        transaction: tx,
      });
      return submission;
    }) as Promise<CustomFormSubmission>;
  }

  return { get, create, submit };
}
