import type { SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { TeamRef } from '../../../../shared/common.ts';

/*
 * Owners name kernel teams. application.yaml writes "team/payments", the UI sends a team's
 * id; both must name a team that exists, or the write is refused. An application with no
 * owner is allowed and lands in No owner, which blocks protected deploys.
 */

/** "Checkout web" → "checkout-web": how application.yaml names a team. */
export function teamSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export const ownerRefOf = (team: { name: string }) => `team/${teamSlug(team.name)}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A team by id or by "team/<slug>"; null when the owner is null. */
export async function findOwner(sql: SqlExecutor, owner: string | null): Promise<TeamRef | null> {
  if (owner === null) return null;
  if (UUID.test(owner)) {
    const [team] = await sql<TeamRef[]>`select id, name from teams where id = ${owner}::uuid`;
    return team ?? null;
  }
  const slug = owner.replace(/^team\//, '');
  const teams = await sql<TeamRef[]>`
    select id, name from teams
    where trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) = ${slug}
    order by id limit 2`;
  return teams.length === 1 ? (teams[0] ?? null) : null;
}

export async function resolveOwner(
  sql: SqlExecutor,
  owner: string | null,
): Promise<TeamRef | null> {
  if (owner === null) return null;
  const team = await findOwner(sql, owner);
  if (!team) {
    throw new ValidationError(
      `No team matches "${owner}". Owners name a team from Bemmoly's teams, like team/payments.`,
      { details: { fields: { owner: 'Not a team' } } },
    );
  }
  return team;
}
