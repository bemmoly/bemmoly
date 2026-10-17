import { describe, expect, it } from 'vitest';
import { emptyState, type Action, type SimCatalog, type SimState } from './model.ts';
import { createPlanner } from './plan.ts';

const id = (n: number) => `00000000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;

function catalog(): SimCatalog {
  const people = [id(901), id(902), id(903), id(904)];
  return {
    apps: ['checkout-api', 'ledger-api', 'search-web'].map((key, i) => ({
      id: id(i + 1),
      key,
      domainKey: 'commerce',
      groupKey: 'checkout',
      teamId: id(800),
      repositoryId: null,
      members: people,
      tier: i,
      weight: 3 - i,
      version: { major: 1, minor: i, patch: 0 },
    })),
    envs: [
      { id: id(101), key: 'dev', class: 'dev' },
      { id: id(102), key: 'staging', class: 'staging' },
      { id: id(103), key: 'prod-asia-south1', class: 'prod' },
      { id: id(104), key: 'prod-us-east1', class: 'prod' },
      { id: id(105), key: 'prod-eu-west1', class: 'prod' },
    ],
    poolIds: [id(201), id(202)],
    demoId: people[0] ?? null,
  };
}

const START = Date.parse('2026-10-17T05:00:00Z');
const LIMITS = { runs: 6, promotions: 3, deployments: 10 };

/** Two simulated hours, one action a second, as the script would take them. */
function simulate(seed: number, steps = 7200) {
  const planner = createPlanner(catalog(), seed, LIMITS);
  const state: SimState = emptyState();
  const actions: Action[] = [];
  let maxRuns = 0;
  let clash = false;
  for (let i = 0; i < steps; i += 1) {
    actions.push(planner.next(state, START + i * 1000));
    maxRuns = Math.max(maxRuns, state.runs.length);
    const targets = state.deployments.map((d) => `${d.appId}/${d.envId}`);
    clash ||= new Set(targets).size !== targets.length;
  }
  return { actions, state, maxRuns, clash };
}

describe('the demo simulator planner', () => {
  it('plans the same actions for the same seed and different ones for another', () => {
    const first = simulate(7, 1500);
    const again = simulate(7, 1500);
    expect(again.actions).toEqual(first.actions);
    expect(simulate(8, 1500).actions).not.toEqual(first.actions);
  });

  it('moves runs, releases, deployments, canaries and approvals within its limits', () => {
    const { actions, maxRuns, clash } = simulate(7);
    const kinds = new Set(actions.map((a) => a.kind));
    for (const kind of [
      'run.start',
      'job.start',
      'job.finish',
      'deployment.start',
      'deployment.step',
      'promotion.request',
      'promotion.approve',
      'promotion.wave',
      'promotion.finish',
    ]) {
      expect(kinds, kind).toContain(kind);
    }
    const steps = actions.filter((a) => a.kind === 'deployment.step');
    expect(steps.some((a) => a.state === 'canary' && a.traffic === 25)).toBe(true);
    expect(steps.some((a) => a.state === 'succeeded')).toBe(true);
    expect(actions.some((a) => a.kind === 'job.finish' && !a.passed)).toBe(true);
    expect(actions.some((a) => a.kind === 'job.finish' && a.release !== null)).toBe(true);
    expect(maxRuns).toBeLessThanOrEqual(LIMITS.runs);
    expect(clash).toBe(false);
  });

  it('settles a run the way the orchestrator does: nothing runs behind a failure', () => {
    const { actions } = simulate(7);
    const started = new Map<string, Set<string>>();
    const failed = new Map<string, string>();
    for (const a of actions) {
      if (a.kind === 'run.start') started.set(a.run.id, new Set());
      if (a.kind === 'job.start') started.get(a.runId)?.add(a.jobName);
      if (a.kind === 'job.finish' && !a.passed && a.jobName.startsWith('Build'))
        failed.set(a.runId, a.jobName);
    }
    for (const runId of failed.keys()) expect(started.get(runId)?.size).toBe(1);
  });

  it('forgets what the database refused', () => {
    const planner = createPlanner(catalog(), 3, LIMITS);
    const state = emptyState();
    const action = planner.next(state, START);
    expect(action.kind).toBe('run.start');
    planner.forget(state, action);
    expect(state.runs).toHaveLength(0);
  });
});
