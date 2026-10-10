import type { SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import { between } from '../../../../shared/lexorank.ts';

export interface RankPlacement {
  spaceId: string;
  parentId: string | null;
  afterId?: string | null | undefined;
  beforeId?: string | null | undefined;
  /** The page being moved, which never counts as its own neighbour. */
  excludeId?: string;
}

const siblingsOf = (sql: SqlExecutor, placement: RankPlacement) => sql`
  space_id = ${placement.spaceId}
  and parent_id is not distinct from ${placement.parentId}::uuid
  and deleted_at is null
  and id <> ${placement.excludeId ?? '00000000-0000-0000-0000-000000000000'}::uuid`;

async function neighbour(sql: SqlExecutor, placement: RankPlacement, id: string) {
  const [row] = await sql<{ position: string }[]>`
    select position from pages where id = ${id} and ${siblingsOf(sql, placement)}`;
  if (!row) throw new ValidationError('The neighbour is not a page under the same parent');
  return row.position;
}

/**
 * The lexorank for a page placed among its siblings: after one, before one,
 * between two, or at the end when neither is named. Only one neighbour named
 * means the page goes right next to it, so the other side is read here.
 */
export async function rankAmongSiblings(
  sql: SqlExecutor,
  placement: RankPlacement,
): Promise<string> {
  const siblings = siblingsOf(sql, placement);
  let lower = placement.afterId ? await neighbour(sql, placement, placement.afterId) : null;
  let upper = placement.beforeId ? await neighbour(sql, placement, placement.beforeId) : null;
  if (lower !== null && upper === null) {
    const [next] = await sql<{ position: string }[]>`
      select position from pages where ${siblings} and position > ${lower}
      order by position limit 1`;
    upper = next?.position ?? null;
  } else if (upper !== null && lower === null) {
    const [previous] = await sql<{ position: string }[]>`
      select position from pages where ${siblings} and position < ${upper}
      order by position desc limit 1`;
    lower = previous?.position ?? null;
  } else if (lower === null && upper === null) {
    const [last] = await sql<{ position: string }[]>`
      select position from pages where ${siblings} order by position desc limit 1`;
    lower = last?.position ?? null;
  }
  if (lower !== null && upper !== null && lower >= upper) {
    throw new ValidationError('afterId must come before beforeId');
  }
  return between(lower, upper);
}
