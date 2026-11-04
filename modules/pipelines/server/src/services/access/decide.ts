import type { AccessAction, AskWho, TraceStep } from '../../../../shared/access.ts';
import { askWhoFor, describePerson, grantsOf, heldRoles, teamsHolding } from './grants.ts';
import { checkEnvironmentWindow, checkPolicies } from './policy-check.ts';
import { ACTION_PHRASES, POLICY_ACTIONS, roleList, rolesFor, withArticle } from './roles.ts';
import type { AccessFacts, Decision } from './types.ts';

/*
 * One access decision from its facts, with no I/O: roles first (the person's role, team
 * bindings), then the environment's own deployers, then policies. The first refusal decides
 * the sentence; the trace keeps every step, so "Why can't I?" and the checker show the same
 * reasoning.
 */

const DEPLOYING: ReadonlySet<AccessAction> = new Set(['deploy', 'rollback']);

/** An environment that names its deployers lets only them (and Platform admins) deploy. */
function deployerDenial(facts: AccessFacts, action: AccessAction, admin: boolean) {
  const deployers = facts.environment?.deployers;
  if (!deployers || !DEPLOYING.has(action) || admin) return null;
  const { person } = facts;
  if (deployers.users.includes(person.id)) return null;
  if (deployers.groups.some((group) => person.groups.includes(group))) return null;
  return `${facts.environment?.name ?? 'This environment'} lets only the people it names deploy there.`;
}

/** "checkout-api in Prod · asia-south1", "Commerce", "Acme". */
export function targetName(facts: AccessFacts): string {
  const node = facts.path.at(-1);
  const base = facts.application?.key ?? node?.name ?? 'the organisation';
  return facts.environment ? `${base} in ${facts.environment.name}` : base;
}

export function decide(facts: AccessFacts, action: AccessAction): Decision {
  const target = targetName(facts);
  const grants = grantsOf(facts);
  const roles = heldRoles(grants);
  const trace: TraceStep[] = grants.map((grant) => grant.trace);
  const protectedEnv = facts.environment?.protected ?? false;
  const qualifying = rolesFor(action, protectedEnv);
  const base = { action, roles: [...roles], decisionId: null };
  const person = describePerson(facts, grants, facts.application?.key ?? target);

  if (roles.size === 0) {
    // Nobody but the installing admin is in until invited: no role, no place.
    trace.push({
      kind: 'fact',
      text: `${facts.person.name} has no role`,
      effect: 'deny',
      ref: null,
    });
    return {
      ...base,
      allowed: false,
      sentence: `${facts.person.name} has no role in Pipelines yet. A Platform admin invites people.`,
      trace,
      askWho: { teams: [], label: 'Ask a Platform admin' },
      policies: [],
    };
  }
  if (action === 'view') {
    // Everyone with a role sees the whole catalog; roles narrow actions only.
    trace.push({
      kind: 'fact',
      text: 'Everyone who uses Pipelines can view it',
      effect: 'grant',
      ref: null,
    });
    return {
      ...base,
      allowed: true,
      sentence: `Allowed. ${person}`,
      trace,
      askWho: null,
      policies: [],
    };
  }
  if (!qualifying.some((role) => roles.has(role))) {
    const needs = qualifying.filter((role) => role !== 'platform_admin');
    const shown = needs.length > 0 ? needs : qualifying;
    const what = `${capitalise(ACTION_PHRASES[action])} ${target}`;
    const sentence = `${person} ${what} needs ${withArticle(roleList(shown))}.`;
    trace.push({
      kind: 'binding',
      text: `${what} needs ${roleList(shown)}${protectedEnv ? ' (protected environment)' : ''}`,
      effect: 'deny',
      ref: null,
    });
    return {
      ...base,
      allowed: false,
      sentence,
      trace,
      askWho: askWhoFor(teamsHolding(facts, qualifying)),
      policies: [],
    };
  }

  let denial: { sentence: string; askWho: AskWho | null } | null = null;
  const notDeployer = deployerDenial(facts, action, roles.has('platform_admin'));
  if (notDeployer) {
    trace.push({ kind: 'fact', text: notDeployer, effect: 'deny', ref: null });
    denial = { sentence: notDeployer, askWho: { teams: [], label: 'Ask a Platform admin' } };
  }

  const policies =
    POLICY_ACTIONS.has(action) && facts.environment
      ? checkPolicies(facts, action, roles)
      : { trace: [], matched: [], denial: null };
  const windowCheck = checkEnvironmentWindow(facts, action);
  trace.push(...policies.trace, ...windowCheck.trace);
  denial ??= policies.denial ?? windowCheck.denial;

  if (denial) {
    return {
      ...base,
      allowed: false,
      sentence: `${person} ${denial.sentence}`,
      trace,
      askWho: denial.askWho,
      policies: policies.matched,
    };
  }
  const still = policies.matched.map((policy) => `${policy.name}: ${policy.sentence}`);
  const sentence = [`Allowed. ${person}`, ...still].join(' ');
  return { ...base, allowed: true, sentence, trace, askWho: null, policies: policies.matched };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
