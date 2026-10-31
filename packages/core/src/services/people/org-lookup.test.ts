import type { Person } from '@bemmoly/shared/people';
import { describe, expect, it } from 'vitest';
import type { PersonDirectory } from '../../contracts/people.ts';
import { createPersonOrgLookup } from './org-lookup.ts';

const person = (userId: string, extra: Partial<Person> = {}) => ({ userId, ...extra }) as Person;

const directory = {
  managerChain: async () => [person('m1'), person('m2'), person('m3')],
  get: async (id: string) => (id === 'r' ? person('r', { costCentreId: 'cc-own' }) : null),
  costCentre: async (id: string) => ({ id, ownerUserId: `owner-of-${id}` }),
} as unknown as PersonDirectory;

const context = (fields: Record<string, unknown> = {}) => ({
  requesterId: 'r',
  moduleId: 'people',
  subject: { kind: 'leave_request', id: 'x' },
  fields: fields as never,
});

describe('the person record as the approval engine’s org lookup', () => {
  const org = createPersonOrgLookup(directory);

  it('walks the manager chain only as far as asked', async () => {
    expect(await org.managerChain('r', 2)).toEqual(['m1', 'm2']);
  });

  it('asks the named cost centre, else the requester’s own', async () => {
    expect(await org.costCentreOwner(context({ costCentre: 'cc-x' }))).toBe('owner-of-cc-x');
    expect(await org.costCentreOwner(context())).toBe('owner-of-cc-own');
  });
});
