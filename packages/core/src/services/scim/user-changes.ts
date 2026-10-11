import {
  emailSchema,
  ValidationError,
  type ScimPatchOperation,
  type ScimUserInput,
} from '@bemmoly/shared';

/** What a SCIM write may change on a person, in this system's terms. */
export interface UserChanges {
  email?: string;
  name?: string;
  active?: boolean;
  externalId?: string;
}

function emailOf(input: Pick<ScimUserInput, 'userName' | 'emails'>): string {
  const candidates = [
    input.userName,
    input.emails?.find((email) => email.primary)?.value,
    input.emails?.[0]?.value,
  ];
  for (const candidate of candidates) {
    const parsed = emailSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  throw new ValidationError('A user needs an email address as userName or in emails', {
    details: { scimType: 'invalidValue' },
  });
}

function nameOf(input: Pick<ScimUserInput, 'displayName' | 'name'>): string | undefined {
  const given = [input.name?.givenName, input.name?.familyName].filter(Boolean).join(' ');
  const name = input.displayName || input.name?.formatted || given;
  return name ? name.slice(0, 100) : undefined;
}

/** A full resource, from POST or PUT. */
export function changesFromResource(input: ScimUserInput): UserChanges & { email: string } {
  const name = nameOf(input);
  return {
    email: emailOf(input),
    ...(name ? { name } : {}),
    ...(input.active === undefined ? {} : { active: input.active }),
    ...(input.externalId === undefined ? {} : { externalId: input.externalId }),
  };
}

const asBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' && /^(true|false)$/i.test(value))
    return value.toLowerCase() === 'true';
  throw new ValidationError('active must be true or false', {
    details: { scimType: 'invalidValue' },
  });
};

const asText = (value: unknown, field: string): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new ValidationError(`${field} must be a string`, { details: { scimType: 'invalidValue' } });
};

function applyPath(changes: UserChanges, path: string, value: unknown): void {
  const key = path.toLowerCase();
  if (key === 'active') changes.active = asBoolean(value);
  else if (key === 'username') changes.email = emailOf({ userName: asText(value, 'userName') });
  else if (key === 'displayname' || key === 'name.formatted') changes.name = asText(value, path);
  else if (key === 'externalid') changes.externalId = asText(value, 'externalId');
  else if (key.startsWith('emails')) {
    const list = Array.isArray(value) ? value : [{ value, primary: true }];
    changes.email = emailOf({ userName: '', emails: list as ScimUserInput['emails'] });
  }
  // Other attributes (title, locale, phone numbers, enterprise extension) are not kept.
}

/** PATCH operations, folded into one set of changes. Removing an attribute is ignored. */
export function changesFromPatch(operations: readonly ScimPatchOperation[]): UserChanges {
  const changes: UserChanges = {};
  for (const operation of operations) {
    if (operation.op === 'remove') continue;
    if (operation.path) {
      applyPath(changes, operation.path, operation.value);
    } else if (operation.value && typeof operation.value === 'object') {
      for (const [path, value] of Object.entries(operation.value as Record<string, unknown>)) {
        if (path === 'name' && value && typeof value === 'object') {
          const name = nameOf({ name: value as ScimUserInput['name'] });
          if (name) changes.name = name;
        } else {
          applyPath(changes, path, value);
        }
      }
    }
  }
  return changes;
}
