import {
  ConflictError,
  createCustomFieldBodySchema,
  NotFoundError,
  updateCustomFieldBodySchema,
  validateFieldValues,
  ValidationError,
  type CreateCustomFieldBody,
  type CustomFieldDefinition,
  type FieldScope,
  type UpdateCustomFieldBody,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import {
  CUSTOM_FIELDS_CAPABILITY,
  definitionsOf,
  toDefinition,
  userIdOf,
  WORKSPACE,
  type CustomFieldsDeps,
  type DefinitionRow,
} from './context.ts';

const json = (value: unknown) => JSON.stringify(value);

/** A default must itself be a value the field accepts, or every create would fail on it. */
function checkDefault(field: Omit<CustomFieldDefinition, 'id' | 'archived'>) {
  if (field.defaultValue === null) return;
  const result = validateFieldValues(
    [field],
    { [field.key]: field.defaultValue },
    { mode: 'update' },
  );
  if (!result.ok)
    throw new ValidationError(`The default does not fit the field: ${result.issues[0]?.message}`, {
      details: { issues: [{ path: 'defaultValue', message: result.issues[0]?.message }] },
    });
}

export function createDefinitionsService(deps: CustomFieldsDeps) {
  const { sql } = deps;

  async function byId(id: string): Promise<DefinitionRow> {
    const [row] = await sql<
      DefinitionRow[]
    >`select * from custom_field_definitions where id = ${id}`;
    if (!row) throw new NotFoundError('That field does not exist');
    return row;
  }

  return {
    /** Every active field of a scope; values are filtered by role when read, not the list. */
    list: (scope: FieldScope, options: { includeArchived?: boolean } = {}) =>
      definitionsOf(sql, scope, options.includeArchived),

    async create(actor: Actor, body: CreateCustomFieldBody): Promise<CustomFieldDefinition> {
      await deps.authorize(actor, CUSTOM_FIELDS_CAPABILITY, WORKSPACE);
      const input = createCustomFieldBodySchema.parse(body);
      checkDefault({ ...input, id: '', archived: false } as CustomFieldDefinition);
      return sql.begin(async (tx) => {
        const [row] = await tx<DefinitionRow[]>`
          insert into custom_field_definitions (module_id, entity_type, key, label, description,
            kind, required, options, validation, default_value, visible_to, editable_by,
            position, created_by)
          values (${input.moduleId}, ${input.entityType}, ${input.key}, ${input.label},
            ${input.description}, ${input.kind}, ${input.required}, ${json(input.options)}::jsonb,
            ${json(input.validation)}::jsonb,
            ${input.defaultValue === null ? null : json(input.defaultValue)}::jsonb,
            ${input.visibleTo}, ${input.editableBy}, ${input.position}, ${userIdOf(actor)})
          on conflict (module_id, entity_type, key) do nothing
          returning *`;
        if (!row) throw new ConflictError(`A field with the key ${input.key} already exists`);
        const field = toDefinition(row);
        await deps.audit.record(
          {
            actor,
            action: 'custom_field.created',
            target: { kind: 'custom_field', id: field.id },
            after: field,
          },
          tx,
        );
        return field;
      }) as Promise<CustomFieldDefinition>;
    },

    async update(actor: Actor, id: string, body: UpdateCustomFieldBody) {
      await deps.authorize(actor, CUSTOM_FIELDS_CAPABILITY, WORKSPACE);
      const patch = updateCustomFieldBodySchema.parse(body);
      const before = toDefinition(await byId(id));
      const next = { ...before, ...patch };
      if (['select', 'multi_select'].includes(next.kind) && next.options.length === 0)
        throw new ValidationError('Add at least one option');
      checkDefault(next);
      return sql.begin(async (tx) => {
        const [row] = await tx<DefinitionRow[]>`
          update custom_field_definitions set label = ${next.label},
            description = ${next.description}, required = ${next.required},
            options = ${json(next.options)}::jsonb, validation = ${json(next.validation)}::jsonb,
            default_value = ${next.defaultValue === null ? null : json(next.defaultValue)}::jsonb,
            visible_to = ${next.visibleTo}, editable_by = ${next.editableBy},
            position = ${next.position},
            archived_at = case when ${next.archived} then coalesce(archived_at, now()) end,
            updated_at = now()
          where id = ${id} returning *`;
        const field = toDefinition(row!);
        await deps.audit.record(
          {
            actor,
            action: 'custom_field.updated',
            target: { kind: 'custom_field', id },
            before,
            after: field,
          },
          tx,
        );
        return field;
      }) as Promise<CustomFieldDefinition>;
    },
  };
}
