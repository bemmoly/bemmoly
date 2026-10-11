import { NotFoundError } from '@bemmoly/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import type { Actor } from '../../contracts/authz.ts';
import { scimResources } from '../../models/identity/index.ts';
import type { RequestMeta } from '../audit/index.ts';

export type ScimResourceType = 'user' | 'group';

export interface ScimContext {
  db: Database;
  /** The SCIM base URL, for each resource's meta.location. */
  baseUrl: string;
  actor: Actor;
  meta: RequestMeta;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** SCIM ids are this system's ids; anything that is not a UUID cannot name a resource. */
export function assertScimId(id: string, kind: string): string {
  if (!UUID.test(id)) throw new NotFoundError(`${kind} ${id} not found`);
  return id.toLowerCase();
}

export async function externalIdsOf(
  db: Database,
  type: ScimResourceType,
  ids: readonly string[],
): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: scimResources.resourceId, externalId: scimResources.externalId })
    .from(scimResources)
    .where(and(eq(scimResources.resourceType, type), inArray(scimResources.resourceId, [...ids])));
  return new Map(rows.map((row) => [row.id, row.externalId]));
}

export async function idsByExternalId(db: Database, type: ScimResourceType, externalId: string) {
  const rows = await db
    .select({ id: scimResources.resourceId })
    .from(scimResources)
    .where(and(eq(scimResources.resourceType, type), eq(scimResources.externalId, externalId)));
  return rows.map((row) => row.id);
}

/** Records that the identity provider manages this resource, under its externalId. */
export async function linkResource(
  db: Database,
  type: ScimResourceType,
  resourceId: string,
  externalId: string | undefined,
): Promise<void> {
  await db
    .insert(scimResources)
    .values({ resourceType: type, resourceId, externalId: externalId ?? null })
    .onConflictDoUpdate({
      target: [scimResources.resourceType, scimResources.resourceId],
      set: {
        ...(externalId === undefined ? {} : { externalId }),
        updatedAt: new Date(),
      },
    });
}

export async function unlinkResource(db: Database, type: ScimResourceType, resourceId: string) {
  await db
    .delete(scimResources)
    .where(and(eq(scimResources.resourceType, type), eq(scimResources.resourceId, resourceId)));
}
