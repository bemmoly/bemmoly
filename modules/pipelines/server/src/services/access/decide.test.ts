import { describe, expect, it } from 'vitest';
import { accessDecisionSchema } from '../../../../shared/access.ts';
import { decide } from './decide.ts';
import {
  CHECKOUT_API,
  COMMERCE,
  facts,
  INSIDE,
  ORG,
  OUTSIDE,
  policy,
  PRIYA,
  STAGING,
  TEAMS,
  teamBinding,
  TIER0,
} from './testing.ts';

const texts = (decision: ReturnType<typeof decide>) => decision.trace.map((step) => step.text);

describe('roles from bindings and ownership', () => {
  it('lets everyone in engineering view through the organisation binding', () => {
    const decision = decide(facts({ environment: null }), 'view');
    expect(decision.allowed).toBe(true);
    expect(texts(decision)).toContain('Everyone who uses Pipelines can view it');
  });

  it('makes the owning team Maintainer without a stored binding', () => {
    const decision = decide(facts({ person: PRIYA, environment: STAGING }), 'change_variables');
    expect(decision.allowed).toBe(true);
    expect(decision.roles).toContain('maintainer');
    expect(decision.trace).toContainEqual(
      expect.objectContaining({
        kind: 'ownership',
        text: 'Payments owns checkout-api: Maintainer',
      }),
    );
  });

  it('refuses a Developer the settings and names the owning team to ask', () => {
    const decision = decide(facts({ environment: null }), 'manage');
    expect(decision.allowed).toBe(false);
    expect(decision.sentence).toBe(
      'Jon is a Developer on checkout-api through Checkout web. Change the settings of checkout-api needs a Maintainer.',
    );
    expect(decision.askWho).toEqual({ teams: [TEAMS.payments], label: 'Ask Payments for access' });
  });

  it('keeps deploys to protected environments for Release managers', () => {
    const decision = decide(facts({ person: PRIYA }), 'deploy');
    expect(decision.allowed).toBe(false);
    expect(decision.sentence).toContain('needs a Release manager');
    expect(decision.askWho?.teams).toEqual([TEAMS.commerceRm]);
  });

  it('keeps a protected environment’s variables for the roles that may deploy there', () => {
    const decision = decide(facts({ person: PRIYA }), 'change_variables');
    expect(decision.allowed).toBe(false);
    expect(decision.sentence).toContain('needs a Release manager');
    expect(decide(facts({ person: PRIYA, environment: null }), 'change_variables').allowed).toBe(
      true,
    );
  });

  it('lets a Developer deploy to an environment that is not protected', () => {
    expect(decide(facts({ environment: STAGING }), 'deploy').allowed).toBe(true);
  });

  it('applies a binding for one environment class only there', () => {
    const prodOnly = teamBinding(TEAMS.checkoutWeb, 'release_manager', COMMERCE, 'prod');
    const base = facts();
    const withBinding = { ...base, bindings: [...base.bindings, prodOnly] };
    expect(decide({ ...withBinding, policies: [] }, 'deploy').allowed).toBe(true);
    expect(decide({ ...withBinding, environment: STAGING }, 'approve').allowed).toBe(false);
  });

  it('ignores an expired break-glass binding and explains a live one', () => {
    const base = facts({ environment: null });
    const person = {
      kind: 'user' as const,
      id: '00000000-0000-4000-8000-000000000012',
      name: 'Jon',
    };
    const expired = {
      ...teamBinding(TEAMS.checkoutWeb, 'maintainer', CHECKOUT_API),
      subject: person,
      expiresAt: new Date(INSIDE.getTime() - 1000),
    };
    expect(decide({ ...base, bindings: [...base.bindings, expired] }, 'manage').allowed).toBe(
      false,
    );
    const live = { ...expired, expiresAt: new Date(INSIDE.getTime() + 3_600_000) };
    const decision = decide({ ...base, bindings: [...base.bindings, live] }, 'manage');
    expect(decision.allowed).toBe(true);
    expect(texts(decision)).toContain('Jon (break-glass): Maintainer at Checkout API');
  });

  it("treats Bemmoly's organisation admins as Platform admins", () => {
    const admin = {
      id: '00000000-0000-4000-8000-000000000020',
      name: 'Ada',
      teams: [],
      orgAdmin: true,
    };
    const decision = decide(facts({ person: admin, bindings: [] }), 'platform');
    expect(decision.allowed).toBe(true);
    expect(texts(decision)[0]).toBe('Ada is an organisation admin: Platform admin at Acme');
  });

  it('asks Platform admins only when nobody closer can grant it', () => {
    const decision = decide(
      facts({ environment: null, path: [ORG], application: null, owner: null }),
      'platform',
    );
    expect(decision.askWho?.label).toBe('Ask Platform for access');
  });
});

describe('policies', () => {
  it('refuses a Developer requesting Tier 0 to Prod, in the product words', () => {
    const decision = decide(facts(), 'request_prod');
    expect(decision.allowed).toBe(false);
    expect(decision.sentence).toBe(
      'Jon is a Developer on checkout-api through Checkout web. Tier 0 to Prod needs a Maintainer to request it.',
    );
    expect(decision.askWho).toEqual({ teams: [TEAMS.payments], label: 'Ask Payments for access' });
    expect(texts(decision)).toEqual([
      'All engineering: Viewer at Acme',
      'Checkout web: Developer at Checkout',
      'Policy Tier 0 to Prod applies',
      'Tier 0 to Prod: requester must match has_role("maintainer")',
      'Tier 0 to Prod: inside its window',
      'Tier 0 to Prod: Needs 2 approvals from the owning team, never the author, and 1 from SRE on call',
      'Tier 0 to Prod: gates tests, security scan, Staging healthy for 30m, error budget > 0, canary',
    ]);
  });

  it('allows the owning team to request it and hands back the requirements', () => {
    const decision = decide(facts({ person: PRIYA }), 'request_prod');
    expect(decision.allowed).toBe(true);
    expect(decision.policies).toEqual([
      expect.objectContaining({ key: 'tier-0-to-prod', requirements: TIER0 }),
    ]);
    expect(decision.trace.filter((step) => step.effect === 'require')).toHaveLength(2);
    expect(accessDecisionSchema.parse(decision)).toBeTruthy();
  });

  it('does not apply a Tier 0 policy to a Tier 1 application', () => {
    const base = facts({ person: PRIYA });
    const tier1 = { ...base, application: { ...base.application!, tier: 1 } };
    const decision = decide(tier1, 'request_prod');
    expect(decision.policies).toEqual([]);
    expect(texts(decision)).not.toContain('Policy Tier 0 to Prod applies');
  });

  it('closes during a freeze, but never for a roll back', () => {
    const freeze = {
      id: '00000000-0000-4000-8000-000000000021',
      name: 'Year-end freeze',
      endsAt: new Date('2027-01-03T00:00:00Z'),
      environmentClass: 'prod' as const,
    };
    const frozen = facts({ person: PRIYA, freezes: [freeze] });
    const request = decide(frozen, 'request_prod');
    expect(request.allowed).toBe(false);
    expect(request.sentence).toContain('Tier 0 to Prod is closed: Year-end freeze is on.');
    expect(decide(frozen, 'rollback').allowed).toBe(true);
  });

  it('refuses deploys outside the window and lets roll backs through', () => {
    const rm = { ...PRIYA, teams: [...PRIYA.teams, TEAMS.commerceRm] };
    expect(decide(facts({ person: rm, now: INSIDE }), 'deploy').allowed).toBe(true);
    const outside = decide(facts({ person: rm, now: OUTSIDE }), 'deploy');
    expect(outside.allowed).toBe(false);
    expect(outside.sentence).toContain(
      'Tier 0 to Prod deploys only Mon to Thu, 10:00 to 16:00 (Asia/Kolkata).',
    );
    expect(decide(facts({ person: rm, now: OUTSIDE }), 'rollback').allowed).toBe(true);
    const request = decide(facts({ person: PRIYA, now: OUTSIDE }), 'request_prod');
    expect(request.allowed).toBe(true);
    expect(request.trace).toContainEqual(
      expect.objectContaining({ kind: 'window', effect: 'require' }),
    );
  });

  it('applies a policy it cannot read, so a broken selector never opens a door', () => {
    const decision = decide(
      facts({ policies: [policy(TIER0, 'application.missing == 1')] }),
      'request_prod',
    );
    expect(decision.allowed).toBe(false);
    expect(texts(decision)[2]).toMatch(/^Policy Tier 0 to Prod could not be read/);
  });

  it('refuses when a deny-if rule cannot be evaluated', () => {
    const broken = policy({ ...TIER0, requester: undefined, denyIf: 'requester.teams[5] == "x"' });
    const decision = decide(facts({ person: PRIYA, policies: [broken] }), 'request_prod');
    expect(decision.allowed).toBe(false);
    expect(decision.sentence).toContain('could not be checked right now');
  });

  it('honours the environment window from its protection settings', () => {
    const rm = { ...PRIYA, teams: [...PRIYA.teams, TEAMS.commerceRm] };
    const base = facts({ person: rm, policies: [], now: OUTSIDE });
    const env = { ...base.environment!, window: 'Mon-Fri 09:00-17:00 Asia/Kolkata' };
    const decision = decide({ ...base, environment: env }, 'deploy');
    expect(decision.sentence).toContain('Prod · asia-south1 takes deploys only Mon to Fri');
  });
});

describe('ownership', () => {
  it('blocks protected deploys of an application with no owner', () => {
    const decision = decide(facts({ owner: null, policies: [] }), 'request_prod');
    expect(decision.allowed).toBe(false);
    expect(decision.sentence).toContain('checkout-api has no owner');
    expect(decide(facts({ owner: null, environment: STAGING }), 'deploy').allowed).toBe(true);
  });
});
