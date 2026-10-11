import { ValidationError, type ScimPatchOperation } from '@bemmoly/shared';

/** What a SCIM write may change on a team: its name and who is on it. */
export interface MembershipChanges {
  displayName?: string;
  /** The whole member list, when the write replaces it. */
  replace?: string[];
  add: string[];
  remove: string[];
  externalId?: string;
}

const MEMBER_FILTER = /^members\[\s*value\s+eq\s+"([^"]+)"\s*\]$/i;

function memberIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return list.map((entry) => {
    const id =
      typeof entry === 'object' && entry !== null ? (entry as { value?: unknown }).value : entry;
    if (typeof id !== 'string' || id.length === 0 || id.length > 64) {
      throw new ValidationError('Each member needs a value', {
        details: { scimType: 'invalidValue' },
      });
    }
    return id;
  });
}

function applyAttribute(changes: MembershipChanges, op: string, path: string, value: unknown) {
  const key = path.toLowerCase();
  if (key === 'displayname') {
    if (typeof value !== 'string' || !value.trim()) {
      throw new ValidationError('displayName must be a string', {
        details: { scimType: 'invalidValue' },
      });
    }
    changes.displayName = value.trim().slice(0, 80);
  } else if (key === 'externalid' && typeof value === 'string') {
    changes.externalId = value;
  } else if (key === 'members') {
    if (op === 'replace') changes.replace = memberIds(value);
    else if (op === 'add') changes.add.push(...memberIds(value));
    else changes.remove.push(...memberIds(value));
  }
}

/** PATCH operations on a group, as the common identity providers send them. */
export function membershipChanges(operations: readonly ScimPatchOperation[]): MembershipChanges {
  const changes: MembershipChanges = { add: [], remove: [] };
  for (const { op, path, value } of operations) {
    const filtered = path ? MEMBER_FILTER.exec(path)?.[1] : undefined;
    if (filtered) {
      if (op === 'remove') changes.remove.push(filtered);
      else changes.add.push(filtered);
    } else if (path) {
      // `remove` on "members" without a value clears the team.
      if (op === 'remove' && path.toLowerCase() === 'members' && value === undefined)
        changes.replace = [];
      else applyAttribute(changes, op, path, value);
    } else if (value && typeof value === 'object') {
      for (const [attribute, inner] of Object.entries(value as Record<string, unknown>)) {
        applyAttribute(changes, op, attribute, inner);
      }
    }
  }
  return changes;
}
