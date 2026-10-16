import type { CiIssuerKind, ClaimMapping } from '../../../../shared/ci.ts';
import { globMatcher, simpleGlobTokens } from '../../utils/glob-match.ts';

/*
 * From a verified CI token to what it may register (architecture §7.1): the issuer's claims
 * are mapped to facts (repository, ref, workflow, environment), and a trust rule for that
 * repository must allow the ref, workflow and environment, and cover the application.
 * A workflow can only register releases for applications in its own repository unless a
 * rule names them. Pure, so every rule is unit-tested.
 */

export interface CiFacts {
  repository: string | null;
  ref: string | null;
  workflow: string | null;
  environment: string | null;
  sha: string | null;
  actor: string | null;
}

const DEFAULTS: Record<CiIssuerKind, Required<ClaimMapping>> = {
  github: {
    repository: 'repository',
    ref: 'ref',
    workflow: 'workflow_ref',
    environment: 'environment',
    sha: 'sha',
    actor: 'actor',
  },
  gitlab: {
    repository: 'project_path',
    ref: 'ref_path',
    workflow: 'ci_config_ref_uri',
    environment: 'environment',
    sha: 'sha',
    actor: 'user_login',
  },
  circleci: {
    repository: 'oidc.circleci.com/vcs-origin',
    ref: 'oidc.circleci.com/vcs-ref',
    workflow: 'oidc.circleci.com/project-id',
    environment: 'oidc.circleci.com/context-ids',
    sha: 'oidc.circleci.com/vcs-sha',
    actor: 'sub',
  },
  buildkite: {
    repository: '{organization_slug}/{pipeline_slug}',
    ref: 'build_branch',
    workflow: 'pipeline_slug',
    environment: 'step_key',
    sha: 'build_commit',
    actor: 'sub',
  },
  oidc: {
    repository: 'repository',
    ref: 'ref',
    workflow: 'workflow',
    environment: 'environment',
    sha: 'sha',
    actor: 'sub',
  },
};

function claim(claims: Record<string, unknown>, name: string): string | null {
  const value = claims[name];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

/** A claim name, or a template of claims: "{organization_slug}/{pipeline_slug}". */
function read(claims: Record<string, unknown>, path: string): string | null {
  if (!path.includes('{')) return claim(claims, path);
  let missing = false;
  const value = path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const found = claim(claims, name);
    if (found === null) missing = true;
    return found ?? '';
  });
  return missing ? null : value;
}

/** "acme/api/.github/workflows/build.yml@refs/heads/main" → ".github/workflows/build.yml". */
function workflowPath(value: string | null, repository: string | null): string | null {
  if (!value) return null;
  const withoutRef = value.split('@')[0] ?? value;
  return repository && withoutRef.startsWith(`${repository}/`)
    ? withoutRef.slice(repository.length + 1)
    : withoutRef;
}

export function factsOf(
  kind: CiIssuerKind,
  mapping: ClaimMapping,
  claims: Record<string, unknown>,
): CiFacts {
  const paths = { ...DEFAULTS[kind], ...mapping };
  const repository = read(claims, paths.repository);
  return {
    repository,
    ref: read(claims, paths.ref),
    workflow: workflowPath(read(claims, paths.workflow), repository),
    environment: read(claims, paths.environment),
    sha: read(claims, paths.sha),
    actor: read(claims, paths.actor),
  };
}

/**
 * `*` matches within a path segment, `**` across segments; the whole value must match.
 * Values are claims a workflow chooses (a branch name), so matching never backtracks.
 */
export function globMatch(pattern: string, value: string): boolean {
  return globMatcher(simpleGlobTokens(pattern, { question: false })).test(value);
}

/** Refs match as written or by branch name: "main" matches "refs/heads/main". */
function refMatches(pattern: string, ref: string): boolean {
  const branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
  return globMatch(pattern, ref) || globMatch(pattern, branch);
}

export interface RuleFacts {
  id: string;
  repository: string;
  refs: readonly string[];
  workflows: readonly string[];
  environments: readonly string[];
  applicationIds: readonly string[];
}

export interface TargetApplication {
  id: string;
  key: string;
  repository: string | null;
}

export type TrustDecision = { allowed: true; ruleId: string } | { allowed: false; reason: string };

export function trustDecision(
  facts: CiFacts,
  rules: readonly RuleFacts[],
  application: TargetApplication,
): TrustDecision {
  if (!facts.repository) return { allowed: false, reason: 'The token names no repository' };
  const repository = facts.repository.toLowerCase();
  const forRepository = rules.filter((rule) => rule.repository.toLowerCase() === repository);
  if (forRepository.length === 0) {
    return { allowed: false, reason: `No trust rule covers ${facts.repository}` };
  }
  const reasons: string[] = [];
  for (const rule of forRepository) {
    const covers =
      rule.applicationIds.length > 0
        ? rule.applicationIds.includes(application.id)
        : application.repository?.toLowerCase() === repository;
    if (!covers) {
      reasons.push(`${application.key} is not in ${facts.repository}`);
      continue;
    }
    if (
      rule.refs.length > 0 &&
      !(facts.ref && rule.refs.some((p) => refMatches(p, facts.ref ?? '')))
    ) {
      reasons.push(`ref ${facts.ref ?? '(none)'} is not one of ${rule.refs.join(', ')}`);
      continue;
    }
    if (
      rule.workflows.length > 0 &&
      !(facts.workflow && rule.workflows.some((p) => globMatch(p, facts.workflow ?? '')))
    ) {
      reasons.push(
        `workflow ${facts.workflow ?? '(none)'} is not one of ${rule.workflows.join(', ')}`,
      );
      continue;
    }
    if (
      rule.environments.length > 0 &&
      !(facts.environment && rule.environments.some((p) => globMatch(p, facts.environment ?? '')))
    ) {
      reasons.push(
        `environment ${facts.environment ?? '(none)'} is not one of ${rule.environments.join(', ')}`,
      );
      continue;
    }
    return { allowed: true, ruleId: rule.id };
  }
  return { allowed: false, reason: [...new Set(reasons)].join('; ') };
}
