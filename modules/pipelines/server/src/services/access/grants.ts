import type { AskWho, Role, TraceStep } from '../../../../shared/access.ts';
import type { TeamRef } from '../../../../shared/common.ts';
import { includedRoles, ROLE_LABELS, withArticle } from './roles.ts';
import type { AccessFacts, BindingFact, ScopeNode } from './types.ts';

/*
 * The effective role set (architecture §10.1): the union of the person's bindings on the
 * path from the organisation to the target, the owning team's implicit Maintainer, and
 * Bemmoly's organisation admins as Platform admins. Each grant is a trace line.
 */

export interface Grant {
  role: Role;
  /** "Checkout web", "Payments, the owning team", "Ada (break-glass)". */
  via: string;
  scope: ScopeNode;
  trace: TraceStep;
}

const scopeLabel = (scope: ScopeNode) => scope.name;

function appliesToPerson(binding: BindingFact, facts: AccessFacts): boolean {
  const { person, environment, now } = facts;
  if (binding.expiresAt && binding.expiresAt.getTime() <= now.getTime()) return false;
  if (binding.environmentClass && binding.environmentClass !== environment?.class) return false;
  if (binding.subject.kind === 'user') return binding.subject.id === person.id;
  return person.teams.some((team) => team.id === binding.subject.id);
}

export function grantsOf(facts: AccessFacts): Grant[] {
  const grants: Grant[] = [];
  const root = facts.path[0];
  if (facts.person.orgAdmin && root) {
    grants.push({
      role: 'platform_admin',
      via: 'Bemmoly organisation admin',
      scope: root,
      trace: {
        kind: 'binding',
        text: `${facts.person.name} is an organisation admin: Platform admin at ${root.name}`,
        effect: 'grant',
        ref: null,
      },
    });
  }
  for (const binding of facts.bindings) {
    if (!appliesToPerson(binding, facts)) continue;
    const via =
      binding.subject.kind === 'team'
        ? binding.subject.name
        : `${binding.subject.name} (break-glass)`;
    const where = binding.environmentClass
      ? `${scopeLabel(binding.scope)}, ${binding.environmentClass} only`
      : scopeLabel(binding.scope);
    grants.push({
      role: binding.role,
      via,
      scope: binding.scope,
      trace: {
        kind: 'binding',
        text: `${via}: ${ROLE_LABELS[binding.role]} at ${where}`,
        effect: 'grant',
        ref: { kind: 'binding', id: binding.id },
      },
    });
  }
  const owner = facts.owner;
  const app = facts.application;
  const target = facts.path.at(-1);
  if (owner && app && target && facts.person.teams.some((team) => team.id === owner.id)) {
    grants.push({
      role: 'maintainer',
      via: `${owner.name}, the owning team`,
      scope: target,
      trace: {
        kind: 'ownership',
        text: `${owner.name} owns ${app.key}: Maintainer`,
        effect: 'grant',
        ref: { kind: 'team', id: owner.id },
      },
    });
  }
  return grants;
}

export function heldRoles(grants: readonly Grant[]): Set<Role> {
  return includedRoles(grants.map((grant) => grant.role));
}

/** The grant that best describes the person on the target: the widest role, then the nearest. */
export function strongestGrant(grants: readonly Grant[]): Grant | null {
  const rank = (role: Role) => includedRoles([role]).size;
  let best: Grant | null = null;
  for (const grant of grants) {
    if (!best || rank(grant.role) > rank(best.role)) best = grant;
  }
  return best;
}

/** "Jon is a Developer on checkout-api through Checkout web." */
export function describePerson(facts: AccessFacts, grants: readonly Grant[], target: string) {
  const best = strongestGrant(grants);
  if (!best) return `${facts.person.name} has no role on ${target}.`;
  return `${facts.person.name} is ${withArticle(ROLE_LABELS[best.role])} on ${target} through ${best.via}.`;
}

/**
 * The teams that hold one of `roles` on the path, who to ask: the owning team first, then
 * the narrowest bindings, and Platform admins only when nobody closer can grant it.
 */
export function teamsHolding(facts: AccessFacts, roles: readonly Role[]): TeamRef[] {
  const wanted = new Set(roles);
  const close = new Map<string, TeamRef>();
  const admins = new Map<string, TeamRef>();
  if (facts.owner && facts.application && wanted.has('maintainer')) {
    close.set(facts.owner.id, facts.owner);
  }
  const depth = (binding: BindingFact) =>
    facts.path.findIndex(
      (node) => node.kind === binding.scope.kind && node.id === binding.scope.id,
    );
  const nearestFirst = [...facts.bindings].sort((a, b) => depth(b) - depth(a));
  for (const binding of nearestFirst) {
    if (binding.subject.kind !== 'team') continue;
    if (binding.expiresAt && binding.expiresAt.getTime() <= facts.now.getTime()) continue;
    if (binding.environmentClass && binding.environmentClass !== facts.environment?.class) continue;
    const grants = includedRoles([binding.role]);
    if (![...wanted].some((role) => grants.has(role))) continue;
    const team = { id: binding.subject.id, name: binding.subject.name };
    const fallback = binding.role === 'platform_admin' && roles.some((r) => r !== 'platform_admin');
    (fallback ? admins : close).set(team.id, team);
  }
  const teams = close.size > 0 ? close : admins;
  return [...teams.values()].slice(0, 3);
}

export function askWhoFor(teams: readonly TeamRef[]): AskWho | null {
  if (teams.length === 0) return null;
  const names = teams.map((team) => team.name);
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
  return { teams: [...teams], label: `Ask ${list} for access` };
}
