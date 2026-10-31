import type {
  CreateCustomFieldBody,
  CustomFieldDefinition,
  FieldValues,
} from '@bemmoly/shared/custom-fields';
import type { Actor } from './authz.ts';
import type { SqlExecutor } from './sql.ts';

/** How a module writes values: `create` fills defaults and checks required fields. */
export interface ModuleFieldWriteOptions {
  mode: 'create' | 'update';
  transaction?: SqlExecutor;
}

/**
 * Typed custom fields (ADR 0052) as one module sees them: always its own module id, an entity
 * type of its choosing. The module authorizes the entity; the kernel enforces each field's
 * roles for reading and editing, and defining a field needs `workspace.settings.manage`.
 */
export interface ModuleCustomFields {
  list(entityType: string): Promise<CustomFieldDefinition[]>;
  create(
    actor: Actor,
    entityType: string,
    body: Omit<CreateCustomFieldBody, 'moduleId' | 'entityType'>,
  ): Promise<CustomFieldDefinition>;
  /** Values per entity id, holding only the fields the actor's role may see. */
  read(
    actor: Actor,
    entityType: string,
    entityIds: readonly string[],
  ): Promise<Map<string, FieldValues>>;
  write(
    actor: Actor,
    entityType: string,
    entityId: string,
    values: FieldValues,
    options: ModuleFieldWriteOptions,
  ): Promise<FieldValues>;
}
