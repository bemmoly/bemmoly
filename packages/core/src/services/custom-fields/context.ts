import type { CustomFieldDefinition, CustomFieldKind, FieldScope } from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { AuditRecorder } from '../../contracts/audit.ts';
import type { Actor, Authorize } from '../../contracts/authz.ts';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';

/** Defining fields and forms changes what every person in the workspace fills in. */
export const CUSTOM_FIELDS_CAPABILITY = 'workspace.settings.manage';
export const WORKSPACE = { kind: 'workspace' } as const;

export interface CustomFieldsDeps {
  sql: SqlClient;
  authorize: Authorize;
  audit: AuditRecorder;
  events: EventBus;
}

export interface DefinitionRow {
  id: string;
  module_id: string;
  entity_type: string;
  key: string;
  label: string;
  description: string | null;
  kind: CustomFieldKind;
  required: boolean;
  options: CustomFieldDefinition['options'];
  validation: CustomFieldDefinition['validation'];
  default_value: unknown;
  visible_to: string[];
  editable_by: string[];
  position: number;
  archived_at: Date | null;
}

export function toDefinition(row: DefinitionRow): CustomFieldDefinition {
  return {
    id: row.id,
    moduleId: row.module_id,
    entityType: row.entity_type,
    key: row.key,
    label: row.label,
    description: row.description,
    kind: row.kind,
    required: row.required,
    options: row.options,
    validation: row.validation,
    defaultValue: row.default_value ?? null,
    visibleTo: row.visible_to,
    editableBy: row.editable_by,
    position: row.position,
    archived: row.archived_at !== null,
  };
}

/** Active definitions of a scope, in their display order. */
export async function definitionsOf(
  db: SqlExecutor,
  scope: FieldScope,
  includeArchived = false,
): Promise<CustomFieldDefinition[]> {
  const rows = await db<DefinitionRow[]>`
    select * from custom_field_definitions
    where module_id = ${scope.moduleId} and entity_type = ${scope.entityType}
      and (${includeArchived} or archived_at is null)
    order by position, key`;
  return rows.map(toDefinition);
}

export const userIdOf = (actor: Actor) => actor.userId ?? (actor.kind === 'user' ? actor.id : null);

/**
 * The workspace role keys of the person behind `actor`, or null for a system actor with no
 * person, which sees and edits every field.
 */
export async function viewerRoles(db: SqlExecutor, actor: Actor): Promise<Set<string> | null> {
  const userId = userIdOf(actor);
  if (!userId) return actor.kind === 'system' ? null : new Set();
  const rows = await db<{ key: string }[]>`
    select r.key from users u join roles r on r.id = u.role_id where u.id = ${userId}`;
  return new Set(rows.map((row) => row.key));
}

/** An empty role list means every role. */
export const allows = (roles: readonly string[], viewer: Set<string> | null) =>
  viewer === null || roles.length === 0 || roles.some((role) => viewer.has(role));
