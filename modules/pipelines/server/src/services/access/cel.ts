import { Environment, type ASTNode } from '@marcbachmann/cel-js';
import type { Role } from '../../../../shared/access.ts';
import { includedRoles } from './roles.ts';

/*
 * Policies are CEL (ADR 0037): side-effect free, bounded, type-checked when saved. One base
 * environment declares what a policy may read; each evaluation clones it to bind has_role()
 * and in_team() to the person asking, so the functions stay pure inside one evaluation.
 */

/** What a policy expression can see. Integers are bigint, as CEL's int is 64-bit. */
export interface CelInput {
  application: {
    key: string;
    name: string;
    tier: bigint;
    labels: string[];
    lifecycle: string;
    runtime: string;
    domain: string;
    group: string;
    owner: string;
    has_owner: boolean;
  };
  env: { key: string; class: string; protected: boolean; region: string };
  action: string;
  requester: { id: string; teams: string[]; roles: string[] };
  freeze: { active: boolean; name: string };
}

const LIMITS = { maxAstNodes: 500, maxDepth: 40, maxListElements: 100, maxCallArguments: 8 };

/*
 * The node limit alone does not bound the work: each nested all(), exists() or map() multiplies
 * it, and six lists of twenty nested take seconds, on the thread that serves every request.
 * Two levels (a label inside a list inside a list) is more than any policy needs.
 */
const MAX_NESTED_LOOPS = 2;
const LOOPS = new Set(['all', 'exists', 'exists_one', 'map', 'filter']);

const isNode = (value: unknown): value is ASTNode =>
  typeof value === 'object' && value !== null && 'op' in value && 'args' in value;

/** How deep all(), exists(), map() and filter() nest in an expression. */
function loopDepth(node: unknown, depth = 0): number {
  if (Array.isArray(node)) return Math.max(depth, ...node.map((item) => loopDepth(item, depth)));
  if (!isNode(node) || node.op === 'value') return depth;
  if (node.op === 'rcall' && LOOPS.has(node.args[0])) {
    const [, receiver, body] = node.args;
    return Math.max(depth + 1, loopDepth(receiver, depth), loopDepth(body, depth + 1));
  }
  return loopDepth(node.args, depth);
}

function loopProblem(ast: ASTNode): string | null {
  return loopDepth(ast) > MAX_NESTED_LOOPS
    ? `Nest all(), exists(), map() and filter() at most ${MAX_NESTED_LOOPS} deep`
    : null;
}

function baseEnvironment(): Environment {
  return new Environment({ limits: LIMITS })
    .registerVariable('application', {
      schema: {
        key: 'string',
        name: 'string',
        tier: 'int',
        labels: 'list<string>',
        lifecycle: 'string',
        runtime: 'string',
        domain: 'string',
        group: 'string',
        owner: 'string',
        has_owner: 'bool',
      },
    })
    .registerVariable('env', {
      schema: { key: 'string', class: 'string', protected: 'bool', region: 'string' },
    })
    .registerVariable('action', 'string')
    .registerVariable('requester', {
      schema: { id: 'string', teams: 'list<string>', roles: 'list<string>' },
    })
    .registerVariable('freeze', { schema: { active: 'bool', name: 'string' } });
}

const BASE = baseEnvironment();
/** The base plus stand-ins for the person-bound functions, for checking a policy as written. */
const CHECKER = BASE.clone()
  .registerFunction('has_role(string): bool', () => false)
  .registerFunction('in_team(string): bool', () => false);

/** The first line of a CEL error: the code frame under it is for a terminal, not a sentence. */
function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n', 1)[0]?.trim() ?? message;
}

export type CelCheck = { ok: true } | { ok: false; error: string };

/** Parses and type-checks an expression that must be a condition (bool). */
export function checkCel(expression: string): CelCheck {
  try {
    const problem = loopProblem(CHECKER.parse(expression).ast);
    if (problem) return { ok: false, error: problem };
    const result = CHECKER.check(expression) as { valid: boolean; type?: string; error?: unknown };
    if (!result.valid) return { ok: false, error: firstLine(result.error) };
    if (result.type && result.type !== 'bool' && result.type !== 'dyn') {
      return {
        ok: false,
        error: `The expression gives ${/^[aeiou]/.test(result.type) ? 'an' : 'a'} ${result.type}, not true or false`,
      };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: firstLine(error) };
  }
}

export type CelResult = { ok: true; value: boolean } | { ok: false; error: string };

/** Evaluates a condition for one person; an error is returned, never thrown, so it can be traced. */
export function evaluateCel(expression: string, input: CelInput): CelResult {
  const roles = includedRoles(input.requester.roles as Role[]);
  const teams = new Set(input.requester.teams.map((team) => team.toLowerCase()));
  try {
    const env = BASE.clone()
      .registerFunction('has_role(string): bool', (role: string) => roles.has(role as Role))
      .registerFunction('in_team(string): bool', (team: string) => teams.has(team.toLowerCase()));
    const parsed = env.parse(expression);
    // A policy saved before the limit existed is refused here rather than run.
    const problem = loopProblem(parsed.ast);
    if (problem) return { ok: false, error: problem };
    const value: unknown = parsed(input as unknown as Record<string, unknown>);
    if (typeof value !== 'boolean') {
      return { ok: false, error: 'The expression did not give true or false' };
    }
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: firstLine(error) };
  }
}

/** `has_role("maintainer")` alone: the common requester rule, worded as a role in sentences. */
export function singleRoleRequirement(expression: string): Role | null {
  const match = /^\s*has_role\(\s*"([a-z_]+)"\s*\)\s*$/.exec(expression);
  return (match?.[1] as Role | undefined) ?? null;
}
