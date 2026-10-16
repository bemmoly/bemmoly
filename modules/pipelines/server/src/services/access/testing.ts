import type { PolicyRequirements, Role } from '../../../../shared/access.ts';
import type { EnvironmentClass } from '../../../../shared/common.ts';
import type { AccessFacts, BindingFact, EnvironmentFacts, PolicyFact, ScopeNode } from './types.ts';

/*
 * Facts for the decision tests: Acme › Commerce › Checkout › checkout-api, owned by
 * Payments, with Jon in Checkout web and Priya in Payments.
 */

export const ORG: ScopeNode = { kind: 'organisation', id: null, key: '', name: 'Acme' };
export const COMMERCE: ScopeNode = {
  kind: 'domain',
  id: '00000000-0000-4000-8000-000000000002',
  key: 'commerce',
  name: 'Commerce',
};
export const CHECKOUT: ScopeNode = {
  kind: 'group',
  id: '00000000-0000-4000-8000-000000000005',
  key: 'checkout',
  name: 'Checkout',
};
export const CHECKOUT_API: ScopeNode = {
  kind: 'application',
  id: '00000000-0000-4000-8000-000000000001',
  key: 'checkout-api',
  name: 'Checkout API',
};

export const TEAMS = {
  payments: { id: '00000000-0000-4000-8000-000000000010', name: 'Payments' },
  checkoutWeb: { id: '00000000-0000-4000-8000-000000000007', name: 'Checkout web' },
  everyone: { id: '00000000-0000-4000-8000-000000000009', name: 'All engineering' },
  platform: { id: '00000000-0000-4000-8000-000000000011', name: 'Platform' },
  commerceRm: { id: '00000000-0000-4000-8000-000000000008', name: 'Commerce release managers' },
};

export const PROD: EnvironmentFacts = {
  id: '00000000-0000-4000-8000-000000000003',
  key: 'prod-asia-south1',
  name: 'Prod · asia-south1',
  class: 'prod',
  protected: true,
  region: 'asia-south1',
  window: null,
};
export const STAGING: EnvironmentFacts = {
  id: '00000000-0000-4000-8000-000000000004',
  key: 'staging',
  name: 'Staging',
  class: 'staging',
  protected: false,
  region: null,
  window: null,
};

let next = 0;
export function teamBinding(
  team: { id: string; name: string },
  role: Role,
  scope: ScopeNode,
  environmentClass: EnvironmentClass | null = null,
): BindingFact {
  next += 1;
  return {
    id: `00000000-0000-4000-9000-${String(next).padStart(12, '0')}`,
    subject: { kind: 'team', ...team },
    role,
    scope,
    environmentClass,
    expiresAt: null,
    reason: null,
  };
}

export const TIER0: PolicyRequirements = {
  requester: 'has_role("maintainer")',
  approvals: [
    { from: 'owning_team', count: 2, exclude: ['authors'] },
    { from: 'oncall:sre', count: 1, exclude: [] },
  ],
  gates: ['tests', 'security_scan', 'staging_healthy("30m")', 'error_budget("> 0")', 'canary'],
  window: 'Mon-Thu 10:00-16:00 Asia/Kolkata',
  denyIf: 'freeze.active',
};

export function policy(requirements: PolicyRequirements, applies?: string): PolicyFact {
  return {
    id: '00000000-0000-4000-8000-000000000006',
    key: 'tier-0-to-prod',
    name: 'Tier 0 to Prod',
    version: 1,
    scope: ORG,
    applies: applies ?? 'application.tier == 0 && env.class == "prod"',
    requirements,
    sentence: 'Needs 2 approvals.',
  };
}

/** A Tuesday at 11:00 in Kolkata: inside the Tier 0 window. */
export const INSIDE = new Date('2026-10-13T05:30:00Z');
/** A Saturday: outside it. */
export const OUTSIDE = new Date('2026-10-17T05:30:00Z');

export function facts(overrides: Partial<AccessFacts> = {}): AccessFacts {
  return {
    person: {
      id: '00000000-0000-4000-8000-000000000012',
      name: 'Jon',
      teams: [TEAMS.checkoutWeb, TEAMS.everyone],
      orgAdmin: false,
    },
    path: [ORG, COMMERCE, CHECKOUT, CHECKOUT_API],
    application: {
      id: '00000000-0000-4000-8000-000000000001',
      key: 'checkout-api',
      name: 'Checkout API',
      tier: 0,
      labels: ['node', 'pci'],
      lifecycle: 'production',
      runtime: 'container-service',
      domainKey: 'commerce',
      groupKey: 'checkout',
    },
    environment: PROD,
    owner: TEAMS.payments,
    bindings: [
      teamBinding(TEAMS.everyone, 'viewer', ORG),
      teamBinding(TEAMS.checkoutWeb, 'developer', CHECKOUT),
      teamBinding(TEAMS.commerceRm, 'release_manager', COMMERCE),
      teamBinding(TEAMS.platform, 'platform_admin', ORG),
    ],
    policies: [policy(TIER0)],
    freezes: [],
    now: INSIDE,
    ...overrides,
  };
}

export const PRIYA = {
  id: '00000000-0000-4000-8000-000000000013',
  name: 'Priya',
  teams: [TEAMS.payments, TEAMS.everyone],
  orgAdmin: false,
};
