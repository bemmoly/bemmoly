import { describe, expect, it } from 'vitest';
import { decide } from './decide.ts';
import { facts, ORG, PROD, STAGING } from './testing.ts';
import type { BindingFact } from './types.ts';

/*
 * The four roles people hold for the whole organisation (Platform › People and roles), on
 * top of the same engine as team bindings.
 */

const ANA = { id: '00000000-0000-4000-8000-000000000030', name: 'Ana', teams: [], groups: [] };

function personRole(role: BindingFact['role'], id = ANA.id): BindingFact {
  return {
    id: '00000000-0000-4000-9000-000000000099',
    subject: { kind: 'user', id, name: ANA.name },
    role,
    scope: ORG,
    environmentClass: null,
    expiresAt: null,
    reason: null,
  };
}

const as = (role: BindingFact['role'] | null, overrides = {}) =>
  facts({
    person: { ...ANA, orgAdmin: false },
    bindings: role ? [personRole(role)] : [],
    policies: [],
    environment: STAGING,
    ...overrides,
  });

describe('person roles', () => {
  it('lets nobody in without a role, not even to look', () => {
    const decision = decide(as(null), 'view');
    expect(decision.allowed).toBe(false);
    expect(decision.sentence).toBe(
      'Ana has no role in Pipelines yet. A Platform admin invites people.',
    );
  });

  it('lets an Approver approve but never run or deploy', () => {
    expect(decide(as('approver'), 'view').allowed).toBe(true);
    expect(decide(as('approver'), 'approve').allowed).toBe(true);
    expect(decide(as('approver'), 'run').allowed).toBe(false);
    expect(decide(as('approver'), 'deploy').allowed).toBe(false);
  });

  it('lets a Developer approve, as a member of an approval group would', () => {
    expect(decide(as('developer'), 'approve').allowed).toBe(true);
    expect(decide(as('viewer'), 'approve').allowed).toBe(false);
  });

  it('explains the grant as the person’s own role', () => {
    const decision = decide(as('developer'), 'deploy');
    expect(decision.allowed).toBe(true);
    expect(decision.trace[0]?.text).toBe("Ana's role: Developer at Acme");
  });

  it('makes an organisation admin a Platform admin until given a role of their own', () => {
    const admin = { ...ANA, orgAdmin: true };
    expect(decide(as(null, { person: admin }), 'platform').allowed).toBe(true);
    expect(decide(as('developer', { person: admin }), 'platform').allowed).toBe(false);
  });

  it('protects no environment for being called production', () => {
    const production = { ...PROD, protected: false };
    expect(decide(as('developer', { environment: production }), 'deploy').allowed).toBe(true);
  });

  it('keeps an environment that names its deployers to them and Platform admins', () => {
    const named = { ...STAGING, deployers: { users: [], groups: ['g-1'] } };
    const refused = decide(as('developer', { environment: named }), 'deploy');
    expect(refused.allowed).toBe(false);
    expect(refused.sentence).toContain('Staging lets only the people it names deploy there.');
    const member = { ...ANA, groups: ['g-1'], orgAdmin: false };
    expect(decide(as('developer', { environment: named, person: member }), 'deploy').allowed).toBe(
      true,
    );
    expect(decide(as('platform_admin', { environment: named }), 'deploy').allowed).toBe(true);
  });
});
