import type { AccessAction, AskWho, Role, TraceStep } from '../../../../shared/access.ts';
import { evaluateCel, singleRoleRequirement, type CelInput } from './cel.ts';
import { askWhoFor, teamsHolding } from './grants.ts';
import { describeApprovals, describeGates } from './sentence.ts';
import { ROLE_LABELS, withArticle } from './roles.ts';
import type { AccessFacts, MatchedPolicy, PolicyFact } from './types.ts';
import { describeWindow, insideWindow, parseWindow } from './window.ts';

/*
 * Policies on top of roles (architecture §10.2). A policy applies when its selector is true
 * for the application and environment; then its requester rule, deny-if rule and window
 * can refuse the action, and its approvals and gates become requirements for the shipping
 * flow. Anything that cannot be evaluated refuses: a fact that is missing never passes.
 * Roll backs are exempt from deny-if rules and windows, so a freeze never blocks a repair.
 */

export interface PolicyOutcome {
  trace: TraceStep[];
  matched: MatchedPolicy[];
  /** The first refusal, if any: its sentence and who could help. */
  denial: { sentence: string; askWho: AskWho | null } | null;
}

const REQUESTER_ACTIONS: ReadonlySet<AccessAction> = new Set(['deploy', 'request_prod']);
const DENY_IF_ACTIONS: ReadonlySet<AccessAction> = new Set([
  'deploy',
  'request_prod',
  'change_variables',
]);

export function celInputOf(facts: AccessFacts, action: AccessAction, roles: Set<Role>): CelInput {
  const app = facts.application;
  const env = facts.environment;
  const freeze = facts.freezes.find(
    (item) => !item.environmentClass || item.environmentClass === env?.class,
  );
  return {
    application: {
      key: app?.key ?? '',
      name: app?.name ?? '',
      tier: BigInt(app?.tier ?? 2),
      labels: app?.labels ?? [],
      lifecycle: app?.lifecycle ?? '',
      runtime: app?.runtime ?? '',
      domain: app?.domainKey ?? '',
      group: app?.groupKey ?? '',
      owner: facts.owner?.name ?? '',
      has_owner: facts.owner !== null,
    },
    env: {
      key: env?.key ?? '',
      class: env?.class ?? '',
      protected: env?.protected ?? false,
      region: env?.region ?? '',
    },
    action,
    requester: {
      id: facts.person.id,
      teams: facts.person.teams.map((team) => team.name),
      roles: [...roles],
    },
    freeze: { active: freeze !== undefined, name: freeze?.name ?? '' },
  };
}

function step(
  kind: TraceStep['kind'],
  text: string,
  effect: TraceStep['effect'],
  policy?: PolicyFact,
): TraceStep {
  return { kind, text, effect, ref: policy ? { kind: 'policy', id: policy.id } : null };
}

export function checkPolicies(
  facts: AccessFacts,
  action: AccessAction,
  roles: Set<Role>,
): PolicyOutcome {
  const input = celInputOf(facts, action, roles);
  const trace: TraceStep[] = [];
  const matched: MatchedPolicy[] = [];
  let denial: PolicyOutcome['denial'] = null;
  const refuse = (sentence: string, askWho: AskWho | null = null) => {
    denial ??= { sentence, askWho };
  };

  for (const freeze of facts.freezes) {
    trace.push({
      kind: 'freeze',
      text: `${freeze.name} is on until ${freeze.endsAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
      effect: 'info',
      ref: { kind: 'freeze', id: freeze.id },
    });
  }

  for (const policy of facts.policies) {
    const applies = evaluateCel(policy.applies, input);
    if (!applies.ok) {
      trace.push(
        step(
          'policy',
          `Policy ${policy.name} could not be read (${applies.error}), so it applies`,
          'info',
          policy,
        ),
      );
    } else if (!applies.value) {
      continue;
    } else {
      trace.push(step('policy', `Policy ${policy.name} applies`, 'info', policy));
    }
    matched.push({
      id: policy.id,
      key: policy.key,
      name: policy.name,
      version: policy.version,
      sentence: policy.sentence,
      requirements: policy.requirements,
    });
    const { requester, denyIf, window, approvals, gates } = policy.requirements;

    if (requester && REQUESTER_ACTIONS.has(action)) {
      const result = evaluateCel(requester, input);
      const role = singleRoleRequirement(requester);
      if (!result.ok || !result.value) {
        const needs =
          role && role in ROLE_LABELS
            ? `${policy.name} needs ${withArticle(ROLE_LABELS[role])} to request it.`
            : `${policy.name} asks that ${requester} holds for the person requesting.`;
        trace.push(
          step('policy', `${policy.name}: requester must match ${requester}`, 'deny', policy),
        );
        refuse(needs, role ? askWhoFor(teamsHolding(facts, [role])) : null);
      } else {
        trace.push(step('policy', `${policy.name}: requester rule met`, 'grant', policy));
      }
    }

    if (denyIf && DENY_IF_ACTIONS.has(action)) {
      const result = evaluateCel(denyIf, input);
      if (!result.ok) {
        trace.push(
          step(
            'policy',
            `${policy.name}: could not check ${denyIf} (${result.error})`,
            'deny',
            policy,
          ),
        );
        refuse(`${policy.name} could not be checked right now, so it refuses until it can.`);
      } else if (result.value) {
        const why =
          input.freeze.active && denyIf.includes('freeze') ? `${input.freeze.name} is on` : denyIf;
        trace.push(step('policy', `${policy.name}: closed because ${why}`, 'deny', policy));
        refuse(`${policy.name} is closed: ${why}.`);
      }
    }

    if (window && action !== 'rollback') {
      const parsed = parseWindow(window);
      if (!parsed.ok) {
        trace.push(
          step('window', `${policy.name}: the window "${window}" cannot be read`, 'deny', policy),
        );
        refuse(`${policy.name} has a window that cannot be read, so it refuses until it is fixed.`);
      } else if (!insideWindow(parsed.window, facts.now)) {
        const when = describeWindow(parsed.window);
        const effect = action === 'deploy' ? 'deny' : 'require';
        trace.push(step('window', `${policy.name}: only ${when}`, effect, policy));
        if (action === 'deploy') refuse(`${policy.name} deploys only ${when}.`);
      } else {
        trace.push(step('window', `${policy.name}: inside its window`, 'info', policy));
      }
    }

    if (approvals.length > 0 && action !== 'rollback') {
      trace.push(
        step('policy', `${policy.name}: ${describeApprovals(approvals)}`, 'require', policy),
      );
    }
    if (gates.length > 0 && action !== 'rollback') {
      trace.push(
        step('policy', `${policy.name}: gates ${describeGates(gates)}`, 'require', policy),
      );
    }
  }
  return { trace, matched, denial };
}

/** The environment's own window, applied like a policy's to deploys (never to roll backs). */
export function checkEnvironmentWindow(facts: AccessFacts, action: AccessAction): PolicyOutcome {
  const env = facts.environment;
  const empty: PolicyOutcome = { trace: [], matched: [], denial: null };
  if (!env?.window || action !== 'deploy') return empty;
  const parsed = parseWindow(env.window);
  if (!parsed.ok) {
    return {
      trace: [
        {
          kind: 'window',
          text: `${env.name}: its window cannot be read`,
          effect: 'deny',
          ref: null,
        },
      ],
      matched: [],
      denial: {
        sentence: `${env.name} has a window that cannot be read; fix it in Platform › Environments.`,
        askWho: null,
      },
    };
  }
  if (insideWindow(parsed.window, facts.now)) return empty;
  const when = describeWindow(parsed.window);
  return {
    trace: [
      { kind: 'window', text: `${env.name}: deploys only ${when}`, effect: 'deny', ref: null },
    ],
    matched: [],
    denial: { sentence: `${env.name} takes deploys only ${when}.`, askWho: null },
  };
}
