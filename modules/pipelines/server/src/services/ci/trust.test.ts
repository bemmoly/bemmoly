import { describe, expect, it } from 'vitest';
import { factsOf, globMatch, trustDecision, type RuleFacts } from './trust.ts';

const GITHUB_CLAIMS = {
  iss: 'https://token.actions.githubusercontent.com',
  sub: 'repo:acme/checkout:ref:refs/heads/main',
  repository: 'acme/checkout',
  ref: 'refs/heads/main',
  workflow_ref: 'acme/checkout/.github/workflows/build.yml@refs/heads/main',
  environment: 'production',
  sha: 'e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8',
  actor: 'priya-n',
};

const APP = { id: 'app-checkout-api', key: 'checkout-api', repository: 'acme/checkout' };

function rule(overrides: Partial<RuleFacts> = {}): RuleFacts {
  return {
    id: 'rule-1',
    repository: 'acme/checkout',
    refs: ['main'],
    workflows: [],
    environments: [],
    applicationIds: [],
    ...overrides,
  };
}

describe('claims to facts', () => {
  it("reads GitHub Actions' claims, with the workflow as a path", () => {
    expect(factsOf('github', {}, GITHUB_CLAIMS)).toEqual({
      repository: 'acme/checkout',
      ref: 'refs/heads/main',
      workflow: '.github/workflows/build.yml',
      environment: 'production',
      sha: 'e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8',
      actor: 'priya-n',
    });
  });

  it("builds Buildkite's repository from a template of claims", () => {
    const facts = factsOf(
      'buildkite',
      {},
      {
        organization_slug: 'acme',
        pipeline_slug: 'checkout',
        build_branch: 'main',
        build_commit: 'abc1234',
      },
    );
    expect(facts).toMatchObject({ repository: 'acme/checkout', ref: 'main', sha: 'abc1234' });
  });

  it('takes an explicit mapping over the defaults', () => {
    expect(factsOf('oidc', { repository: 'project' }, { project: 'acme/api' }).repository).toBe(
      'acme/api',
    );
    expect(factsOf('buildkite', {}, { organization_slug: 'acme' }).repository).toBeNull();
  });
});

describe('globs', () => {
  it('matches * within a segment and ** across', () => {
    expect(globMatch('refs/tags/v*', 'refs/tags/v1.2.3')).toBe(true);
    expect(globMatch('release/*', 'release/2026/10')).toBe(false);
    expect(globMatch('release/**', 'release/2026/10')).toBe(true);
    expect(globMatch('.github/workflows/build.yml', '.github/workflows/build.yml')).toBe(true);
    expect(globMatch('a.b', 'aXb')).toBe(false);
  });
});

describe('trust rules', () => {
  const facts = factsOf('github', {}, GITHUB_CLAIMS);

  it('lets a workflow register releases for applications in its own repository', () => {
    expect(trustDecision(facts, [rule()], APP)).toEqual({ allowed: true, ruleId: 'rule-1' });
  });

  it('refuses an application in another repository unless a rule names it', () => {
    const other = { id: 'app-ledger', key: 'ledger', repository: 'acme/ledger' };
    expect(trustDecision(facts, [rule()], other)).toEqual({
      allowed: false,
      reason: 'ledger is not in acme/checkout',
    });
    expect(trustDecision(facts, [rule({ applicationIds: ['app-ledger'] })], other).allowed).toBe(
      true,
    );
  });

  it('refuses refs, workflows and environments the rule does not allow, saying which', () => {
    const feature = { ...facts, ref: 'refs/heads/feature/x' };
    expect(trustDecision(feature, [rule()], APP)).toEqual({
      allowed: false,
      reason: 'ref refs/heads/feature/x is not one of main',
    });
    const workflows = rule({ workflows: ['.github/workflows/release.yml'] });
    expect(trustDecision(facts, [workflows], APP)).toMatchObject({ allowed: false });
    expect(trustDecision(facts, [rule({ environments: ['production'] })], APP).allowed).toBe(true);
  });

  it('refuses a repository no rule covers, or a token naming none', () => {
    expect(trustDecision({ ...facts, repository: 'evil/fork' }, [rule()], APP)).toEqual({
      allowed: false,
      reason: 'No trust rule covers evil/fork',
    });
    expect(trustDecision({ ...facts, repository: null }, [rule()], APP).allowed).toBe(false);
  });
});
