import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import type { Initiative } from '../../../../shared/index.ts';
import { iso } from '../issues/deps.ts';
import type { Rollup } from './rollup.ts';

export interface InitiativeRow {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  start_at: string | null;
  target_at: string | null;
  archived_at: Date | string | null;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export const INITIATIVE_COLUMNS = `id, name, description, owner_id, start_at::text as start_at,
  target_at::text as target_at, archived_at, created_by, created_at, updated_at`;

export const toInitiative = (
  row: InitiativeRow,
  rollup: Rollup,
  canManage: boolean,
): Initiative => ({
  id: row.id,
  name: row.name,
  description: row.description,
  ownerId: row.owner_id,
  startAt: row.start_at,
  targetAt: row.target_at,
  archivedAt: row.archived_at ? iso(row.archived_at) : null,
  createdBy: row.created_by,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  epics: rollup.epics,
  progress: rollup.progress,
  projectIds: rollup.projectIds,
  canManage,
});

export async function initiativeById(
  sql: SqlExecutor,
  id: string,
  options: { lock?: boolean } = {},
): Promise<InitiativeRow> {
  const [row] = await sql<InitiativeRow[]>`
    select ${sql.unsafe(INITIATIVE_COLUMNS)} from initiatives where id = ${id}
    ${options.lock ? sql`for update` : sql``}`;
  if (!row) throw new NotFoundError('The initiative was not found');
  return row;
}

/** A start after the target would draw the program backwards; say so beside the field. */
export function assertDatesInOrder(startAt: string | null, targetAt: string | null): void {
  if (startAt && targetAt && startAt > targetAt) {
    throw new ValidationError('An initiative starts on or before its target date', {
      details: { path: 'startAt' },
    });
  }
}

const FOREIGN_KEY_VIOLATION = '23503';

/** The owner is the one reference a person types; a missing one is their mistake, not ours. */
export async function storingOwner<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if ((error as { code?: string }).code === FOREIGN_KEY_VIOLATION) {
      throw new ValidationError('The owner is not a person in this workspace', {
        details: { path: 'ownerId' },
      });
    }
    throw error;
  }
}

export interface EpicRef {
  id: string;
  key: string;
  project_id: string;
  level: string;
}

/** The issues `ids` names, with their level, so a link can refuse anything but an epic. */
export async function loadEpicRefs(sql: SqlExecutor, ids: readonly string[]): Promise<EpicRef[]> {
  if (ids.length === 0) return [];
  return sql<EpicRef[]>`
    select i.id, i.key, i.project_id, t.level from issues i
    join issue_types t on t.id = i.type_id
    where i.id = any(${ids}::uuid[]) and i.deleted_at is null`;
}
