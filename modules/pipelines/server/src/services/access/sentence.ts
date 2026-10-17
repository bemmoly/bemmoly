import { stringify } from 'yaml';
import type { PolicyRequirements } from '../../../../shared/access.ts';
import { singleRoleRequirement } from './cel.ts';
import { ROLE_LABELS, withArticle } from './roles.ts';
import { describeWindow, parseWindow } from './window.ts';

/*
 * Policies read as sentences on the Access screen and as code under "Code" (product design,
 * screen 9). Both are derived from the stored requirements, so they never disagree.
 */

type Approval = PolicyRequirements['approvals'][number];
/** Team names for "team:<id>" approver sources; unknown ids read as "a named team". */
export type TeamNames = ReadonlyMap<string, string>;

const ACRONYMS = new Set(['sre', 'qa', 'dba', 'it', 'ops']);

function words(key: string): string {
  return key
    .split(/[-_]/)
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word))
    .join(' ');
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function describeSource(from: Approval['from'], teams: TeamNames = new Map()): string {
  if (from === 'owning_team') return 'the owning team';
  const [kind, value = ''] = from.split(':') as [string, string];
  if (kind === 'team') return teams.get(value) ?? 'a named team';
  if (kind === 'oncall') return `${capitalise(words(value))} on call`;
  const role = ROLE_LABELS[value as keyof typeof ROLE_LABELS];
  return role ? `${withArticle(role)}` : value;
}

/** "Needs 2 approvals from the owning team, never the author, and 1 from SRE on call". */
export function describeApprovals(approvals: readonly Approval[], teams: TeamNames = new Map()) {
  const parts = approvals.map((approval, index) => {
    const count =
      index === 0
        ? `${approval.count} ${approval.count === 1 ? 'approval' : 'approvals'}`
        : `${approval.count}`;
    const never = approval.exclude.includes('authors') ? ', never the author' : '';
    return `${count} from ${describeSource(approval.from, teams)}${never}`;
  });
  if (parts.length === 0) return 'No approvals';
  // A part that already holds a comma ("…, never the author") needs a serial comma after it.
  const and = parts.some((part) => part.includes(',')) ? ', and ' : ' and ';
  const list =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}${and}${parts.at(-1)}`;
  return `Needs ${list}`;
}

const GATE_WORDS: Record<string, string> = {
  tests: 'tests',
  security_scan: 'security scan',
  canary: 'canary',
  staging_healthy: 'Staging healthy',
  error_budget: 'error budget',
  external_check: 'check',
  provenance: 'build provenance',
};

/** `staging_healthy("30m")` → "Staging healthy for 30m". */
export function describeGate(gate: string): string {
  const match = /^([a-z_]+)(?:\((.*)\))?$/.exec(gate.trim());
  if (!match) return gate;
  const name = match[1] ?? gate;
  const argument = (match[2] ?? '').replace(/^"|"$/g, '').trim();
  const label = GATE_WORDS[name] ?? words(name);
  if (!argument) return label;
  if (name === 'staging_healthy') return `${label} for ${argument}`;
  return `${label} ${argument}`;
}

export function describeGates(gates: readonly string[]): string {
  return gates.map(describeGate).join(', ');
}

/** The whole policy as the Access screen reads it. */
export function policySentence(requirements: PolicyRequirements, teams: TeamNames = new Map()) {
  const sentences: string[] = [];
  const role = requirements.requester ? singleRoleRequirement(requirements.requester) : null;
  if (role && role in ROLE_LABELS) {
    sentences.push(`Only ${withArticle(ROLE_LABELS[role])} can request it.`);
  } else if (requirements.requester) {
    sentences.push(`The requester must match ${requirements.requester}.`);
  }
  if (requirements.approvals.length > 0) {
    sentences.push(`${describeApprovals(requirements.approvals, teams)}.`);
  }
  const gates = requirements.gates.filter((gate) => gate !== 'canary');
  if (gates.length > 0) sentences.push(`${capitalise(describeGates(gates))} must pass.`);
  if (requirements.gates.includes('canary')) sentences.push('Canary required.');
  if (requirements.window) {
    const parsed = parseWindow(requirements.window);
    sentences.push(
      parsed.ok ? `Only ${describeWindow(parsed.window)}.` : `Only ${requirements.window}.`,
    );
  }
  if (requirements.denyIf?.trim() === 'freeze.active') sentences.push('Never during a freeze.');
  else if (requirements.denyIf) sentences.push(`Refused when ${requirements.denyIf}.`);
  return sentences.length > 0 ? sentences.join(' ') : 'Adds no requirements.';
}

/** The policy as code, in the shape a platform repository would hold it. */
export function policySource(input: {
  key: string;
  name: string;
  applies: string;
  requirements: PolicyRequirements;
}): string {
  const { requester, approvals, gates, window, denyIf } = input.requirements;
  const require: Record<string, unknown> = {};
  if (requester) require.requester = requester;
  if (approvals.length > 0) require.approvals = approvals;
  if (gates.length > 0) require.gates = gates;
  if (window) require.window = window;
  if (denyIf) require.deny_if = denyIf;
  return stringify(
    { key: input.key, name: input.name, applies: input.applies, require },
    { lineWidth: 100 },
  );
}
