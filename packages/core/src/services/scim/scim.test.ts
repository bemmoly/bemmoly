import { describe, expect, it } from 'vitest';
import { parseScimFilter } from './filter.ts';
import { membershipChanges } from './group-changes.ts';
import { changesFromPatch, changesFromResource } from './user-changes.ts';

describe('SCIM filters', () => {
  it('reads attribute eq "value", case-insensitively, with escapes', () => {
    expect(parseScimFilter('UserName eq "ada@acme.dev"', ['userName'])).toEqual({
      attribute: 'userName',
      value: 'ada@acme.dev',
    });
    expect(parseScimFilter('displayName eq "A \\"quoted\\" team"', ['displayName'])?.value).toBe(
      'A "quoted" team',
    );
    expect(parseScimFilter(undefined, ['userName'])).toBeNull();
  });

  it.each(['userName sw "a"', 'title eq "x"', 'userName eq "a" or userName eq "b"'])(
    'refuses %s',
    (filter) => {
      expect(() => parseScimFilter(filter, ['userName'])).toThrow(/supported/);
    },
  );
});

describe('SCIM user changes', () => {
  it('takes the address from userName, else the primary email', () => {
    expect(changesFromResource({ userName: 'Ada@Acme.dev' }).email).toBe('ada@acme.dev');
    expect(
      changesFromResource({
        userName: 'ada',
        emails: [{ value: 'other@acme.dev' }, { value: 'ada@acme.dev', primary: true }],
        name: { givenName: 'Ada', familyName: 'L.' },
      }),
    ).toMatchObject({ email: 'ada@acme.dev', name: 'Ada L.' });
    expect(() => changesFromResource({ userName: 'no-address' })).toThrow(/email/);
  });

  it('folds PATCH operations as common providers send them', () => {
    expect(
      changesFromPatch([
        { op: 'replace', path: 'active', value: 'False' },
        { op: 'replace', value: { displayName: 'Ada', externalId: 'x-1' } },
        { op: 'add', path: 'emails[type eq "work"].value', value: 'ada@acme.dev' },
        { op: 'remove', path: 'title' },
      ]),
    ).toEqual({ active: false, name: 'Ada', externalId: 'x-1', email: 'ada@acme.dev' });
    expect(() => changesFromPatch([{ op: 'replace', path: 'active', value: 'maybe' }])).toThrow();
  });
});

describe('SCIM group changes', () => {
  it('reads member adds, filtered removes, replaces and renames', () => {
    expect(
      membershipChanges([
        { op: 'add', path: 'members', value: [{ value: 'a' }, { value: 'b' }] },
        { op: 'remove', path: 'members[value eq "c"]' },
        { op: 'replace', value: { displayName: 'Platform' } },
      ]),
    ).toEqual({ add: ['a', 'b'], remove: ['c'], displayName: 'Platform' });
    expect(membershipChanges([{ op: 'remove', path: 'members' }])).toEqual({
      add: [],
      remove: [],
      replace: [],
    });
    expect(
      membershipChanges([{ op: 'replace', path: 'members', value: [{ value: 'z' }] }]),
    ).toEqual({ add: [], remove: [], replace: ['z'] });
  });
});
