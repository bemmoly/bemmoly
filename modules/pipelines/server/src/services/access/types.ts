import type {
  AccessAction,
  AccessDecision,
  PolicyRequirements,
  Role,
} from '../../../../shared/access.ts';
import type { EnvironmentClass, ScopeKind, TeamRef } from '../../../../shared/common.ts';

/*
 * The facts one access decision is made from, loaded once and handed to the pure decision
 * function, so every rule is unit-testable without a database.
 */

/** One step of the catalog path: the organisation, a domain, a group or the application. */
export interface ScopeNode {
  kind: ScopeKind;
  /** Null for the organisation. */
  id: string | null;
  key: string;
  name: string;
}

export type SubjectFact =
  { kind: 'team'; id: string; name: string } | { kind: 'user'; id: string; name: string };

export interface BindingFact {
  id: string;
  subject: SubjectFact;
  role: Role;
  scope: ScopeNode;
  environmentClass: EnvironmentClass | null;
  expiresAt: Date | null;
  reason: string | null;
}

export interface PolicyFact {
  id: string;
  key: string;
  name: string;
  version: number;
  scope: ScopeNode;
  applies: string;
  requirements: PolicyRequirements;
  sentence: string;
}

export interface FreezeFact {
  id: string;
  name: string;
  endsAt: Date;
  environmentClass: EnvironmentClass | null;
}

export interface ApplicationFacts {
  id: string;
  key: string;
  name: string;
  tier: number;
  labels: string[];
  lifecycle: string;
  runtime: string;
  domainKey: string;
  groupKey: string;
}

export interface EnvironmentFacts {
  id: string;
  key: string;
  name: string;
  class: EnvironmentClass;
  protected: boolean;
  region: string | null;
  /** The environment's own window, from its protection settings. */
  window: string | null;
}

export interface PersonFacts {
  id: string;
  name: string;
  teams: TeamRef[];
  /** Bemmoly's organisation admins are Platform admins of Pipelines, so an empty install works. */
  orgAdmin: boolean;
}

export interface AccessFacts {
  person: PersonFacts;
  /** From the organisation down to the target, inclusive. */
  path: ScopeNode[];
  application: ApplicationFacts | null;
  environment: EnvironmentFacts | null;
  owner: TeamRef | null;
  /** Every live binding on the path, for anyone: the person's grant, others' explain who to ask. */
  bindings: BindingFact[];
  /** Enabled policies at a scope on the path, at their current version. */
  policies: PolicyFact[];
  /** Freezes in force now on the path. */
  freezes: FreezeFact[];
  now: Date;
}

/** What other services pass: an application (and environment), or a bare scope. */
export interface AccessTarget {
  /** Application id or key. */
  application?: string;
  /** Environment id or key. */
  environment?: string;
  /** A domain, group or the organisation, when the action is not about one application. */
  scope?: { kind: ScopeKind; id?: string };
}

/** A policy that matched, and what it asks for before the action may complete. */
export interface MatchedPolicy {
  id: string;
  key: string;
  name: string;
  version: number;
  sentence: string;
  requirements: PolicyRequirements;
}

export interface Decision extends AccessDecision {
  action: AccessAction;
  /** The roles the person holds on the target, with everything they include. */
  roles: Role[];
  /** Policies that apply: approvals, gates and windows the shipping flow must satisfy. */
  policies: MatchedPolicy[];
}
