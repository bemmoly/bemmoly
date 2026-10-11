import { SCIM_SCHEMAS } from '@bemmoly/shared';
import type { TeamRow, UserRow } from '../../models/identity/index.ts';

export interface ScimUser {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  name: { formatted: string };
  displayName: string;
  emails: { value: string; primary: boolean; type: string }[];
  active: boolean;
  groups: { value: string; display: string }[];
  meta: { resourceType: 'User'; created: string; lastModified: string; location: string };
}

export interface ScimGroup {
  schemas: string[];
  id: string;
  externalId?: string;
  displayName: string;
  members: { value: string; display: string }[];
  meta: { resourceType: 'Group'; created: string; lastModified: string; location: string };
}

export interface ScimList<Resource> {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: Resource[];
}

export function presentScimUser(
  row: UserRow,
  externalId: string | null,
  teams: readonly { id: string; name: string }[],
  baseUrl: string,
): ScimUser {
  return {
    schemas: [SCIM_SCHEMAS.user],
    id: row.id,
    ...(externalId ? { externalId } : {}),
    userName: row.email,
    name: { formatted: row.name },
    displayName: row.name,
    emails: [{ value: row.email, primary: true, type: 'work' }],
    active: row.status === 'active',
    groups: teams.map((team) => ({ value: team.id, display: team.name })),
    meta: {
      resourceType: 'User',
      created: row.createdAt.toISOString(),
      lastModified: row.updatedAt.toISOString(),
      location: `${baseUrl}/Users/${row.id}`,
    },
  };
}

export function presentScimGroup(
  row: TeamRow,
  externalId: string | null,
  members: readonly { id: string; name: string }[],
  baseUrl: string,
): ScimGroup {
  return {
    schemas: [SCIM_SCHEMAS.group],
    id: row.id,
    ...(externalId ? { externalId } : {}),
    displayName: row.name,
    members: members.map((member) => ({ value: member.id, display: member.name })),
    meta: {
      resourceType: 'Group',
      created: row.createdAt.toISOString(),
      lastModified: row.updatedAt.toISOString(),
      location: `${baseUrl}/Groups/${row.id}`,
    },
  };
}

export function scimList<Resource>(
  resources: Resource[],
  total: number,
  startIndex: number,
): ScimList<Resource> {
  return {
    schemas: [SCIM_SCHEMAS.list],
    totalResults: total,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  };
}
