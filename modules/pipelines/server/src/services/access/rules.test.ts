import { describe, expect, it } from 'vitest';
import { checkCel, evaluateCel, singleRoleRequirement, type CelInput } from './cel.ts';
import { describeApprovals, describeGate, policySentence, policySource } from './sentence.ts';
import { TIER0 } from './testing.ts';
import { describeWindow, insideWindow, parseWindow } from './window.ts';

const input = (overrides: Partial<CelInput> = {}): CelInput => ({
  application: {
    key: 'checkout-api',
    name: 'Checkout API',
    tier: 0n,
    labels: ['pci'],
    lifecycle: 'production',
    runtime: 'container-service',
    domain: 'commerce',
    group: 'checkout',
    owner: 'Payments',
    has_owner: true,
  },
  env: { key: 'prod', class: 'prod', protected: true, region: 'asia-south1' },
  action: 'request_prod',
  requester: { id: 'u', teams: ['Payments'], roles: ['developer'] },
  freeze: { active: false, name: '' },
  ...overrides,
});

describe('CEL', () => {
  it('type-checks policies when they are saved', () => {
    expect(checkCel('application.tier == 0 && env.class == "prod"')).toEqual({ ok: true });
    expect(checkCel('"pci" in application.labels && has_role("maintainer")')).toEqual({ ok: true });
    expect(checkCel('application.tierx == 0')).toEqual({
      ok: false,
      error: expect.stringContaining('tierx'),
    });
    expect(checkCel('application.tier == "0"')).toMatchObject({ ok: false });
    expect(checkCel('application.tier +')).toMatchObject({ ok: false });
    expect(checkCel('application.tier')).toEqual({
      ok: false,
      error: 'The expression gives an int, not true or false',
    });
  });

  it('binds has_role to the person, with the roles a role includes', () => {
    expect(evaluateCel('has_role("developer")', input())).toEqual({ ok: true, value: true });
    expect(evaluateCel('has_role("maintainer")', input())).toEqual({ ok: true, value: false });
    const admin = input({ requester: { id: 'u', teams: [], roles: ['platform_admin'] } });
    expect(evaluateCel('has_role("maintainer")', admin)).toEqual({ ok: true, value: true });
  });

  it('matches teams by name, ignoring case', () => {
    expect(evaluateCel('in_team("payments")', input())).toEqual({ ok: true, value: true });
  });

  it('returns errors instead of throwing', () => {
    expect(evaluateCel('requester.teams[3] == "x"', input())).toMatchObject({ ok: false });
  });

  it('reads a lone has_role rule as a role', () => {
    expect(singleRoleRequirement(' has_role("maintainer") ')).toBe('maintainer');
    expect(singleRoleRequirement('has_role("maintainer") || in_team("sre")')).toBeNull();
  });
});

describe('deploy windows', () => {
  const parsed = parseWindow('Mon-Thu 10:00-16:00 Asia/Kolkata');
  if (!parsed.ok) throw new Error(parsed.error);
  const window = parsed.window;

  it('opens inside the days and hours in the named zone', () => {
    expect(insideWindow(window, new Date('2026-10-13T05:30:00Z'))).toBe(true);
    expect(insideWindow(window, new Date('2026-10-13T10:30:00Z'))).toBe(false);
    expect(insideWindow(window, new Date('2026-10-16T05:30:00Z'))).toBe(false);
  });

  it('runs past midnight when the end is before the start', () => {
    const night = parseWindow('Fri 22:00-02:00 UTC');
    if (!night.ok) throw new Error(night.error);
    expect(insideWindow(night.window, new Date('2026-10-16T23:00:00Z'))).toBe(true);
    expect(insideWindow(night.window, new Date('2026-10-17T01:00:00Z'))).toBe(true);
    expect(insideWindow(night.window, new Date('2026-10-17T03:00:00Z'))).toBe(false);
  });

  it('says what is wrong with a window it cannot read', () => {
    expect(parseWindow('Someday 10:00-16:00')).toMatchObject({ ok: false });
    expect(parseWindow('Mon 25:00-26:00')).toMatchObject({ ok: false });
    expect(parseWindow('Mon 10:00-16:00 Mars/Olympus')).toEqual({
      ok: false,
      error: '"Mars/Olympus" is not a time zone like Asia/Kolkata',
    });
  });

  it('describes itself in words', () => {
    expect(describeWindow(window)).toBe('Mon to Thu, 10:00 to 16:00 (Asia/Kolkata)');
  });
});

describe('policy sentences', () => {
  it('reads the Tier 0 policy as the product design words it', () => {
    expect(policySentence(TIER0)).toBe(
      'Only a Maintainer can request it. Needs 2 approvals from the owning team, never the author, and 1 from SRE on call. Tests, security scan, Staging healthy for 30m, error budget > 0 must pass. Canary required. Only Mon to Thu, 10:00 to 16:00 (Asia/Kolkata). Never during a freeze.',
    );
  });

  it('names teams and roles as approvers', () => {
    const teams = new Map([['0190a1b2-0000-7000-8000-000000000001', 'Security']]);
    expect(
      describeApprovals(
        [
          { from: 'team:0190a1b2-0000-7000-8000-000000000001', count: 1, exclude: [] },
          { from: 'role:release_manager', count: 1, exclude: [] },
        ],
        teams,
      ),
    ).toBe('Needs 1 approval from Security and 1 from a Release manager');
    expect(describeGate('external_check("security.yml")')).toBe('check security.yml');
  });

  it('writes the policy as code', () => {
    const source = policySource({
      key: 'tier-0-to-prod',
      name: 'Tier 0 to Prod',
      applies: 'application.tier == 0',
      requirements: TIER0,
    });
    expect(source).toContain('key: tier-0-to-prod');
    expect(source).toContain('deny_if: freeze.active');
    expect(source).toContain('from: owning_team');
  });
});
