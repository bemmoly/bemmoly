import { externalChecksFor } from '../../ci/index.ts';
import type { GateDefinition } from './contract.ts';

/*
 * Gates answered by the release itself: its tests, the checks its CI reported and its
 * security scan. Bring your CI sends these facts with the release; runner builds carry the
 * run they came from.
 */

export const testsGate: GateDefinition = {
  name: 'tests',
  label: () => 'Tests',
  async evaluate({ release }, _args, { sql }) {
    const summary = release.test_summary;
    if (summary && summary.failed > 0) {
      return {
        state: 'fail',
        reason: `${summary.failed} of ${summary.total} tests failed`,
        evidence: { ...summary },
      };
    }
    if (summary && summary.total > 0) {
      return {
        state: 'pass',
        reason: `${summary.total} tests, 0 failed`,
        evidence: { ...summary },
      };
    }
    if (release.run_id) {
      const [run] = await sql<{ state: string; number: number }[]>`
        select state, number from pipeline_runs where id = ${release.run_id}`;
      if (run?.state === 'passed') {
        return {
          state: 'pass',
          reason: `Run #${run.number} passed`,
          evidence: { run: run.number },
        };
      }
      if (run?.state === 'failed' || run?.state === 'cancelled') {
        return {
          state: 'fail',
          reason: `Run #${run.number} ${run.state}`,
          evidence: { run: run.number },
        };
      }
      if (run) return { state: 'pending', reason: `Run #${run.number} is ${run.state}` };
    }
    return { state: 'pending', reason: 'No test results were reported for this release' };
  },
};

interface Reported {
  name: string;
  verdict: 'pass' | 'fail' | 'pending';
}

/**
 * Checks the company's own CI reported for the release's commit: GitHub check runs,
 * workflow runs and checks reported through Bring your CI. A policy may name the ones it needs,
 * external_check("security.yml"); one that has not reported yet is waited for, never failed.
 */
export const externalChecksGate: GateDefinition = {
  name: 'external_checks',
  label: (args) => (args.length ? `Checks: ${args.join(', ')}` : 'External checks'),
  async evaluate({ release, application, now }, args, { sql }) {
    const [repository] = await sql<{ full_name: string }[]>`
      select r.full_name from pipeline_applications a
      join pipeline_repositories r on r.id = a.repository_id where a.id = ${application.id}`;
    const fromHost = repository
      ? await externalChecksFor(sql, repository.full_name, release.commit_sha)
      : [];
    const checks: Reported[] = fromHost.map((check) => ({
      name: check.name,
      verdict: check.verdict,
    }));
    const required = args.length > 0 ? args : null;
    const considered = required ? checks.filter((check) => required.includes(check.name)) : checks;
    const evidence = { checks: considered };
    const failed = considered.filter((check) => check.verdict === 'fail').map((c) => c.name);
    if (failed.length > 0)
      return { state: 'fail', reason: `${failed.join(', ')} failed`, evidence };
    const missing = (required ?? []).filter((name) => !considered.some((c) => c.name === name));
    const waiting = [
      ...considered.filter((check) => check.verdict === 'pending').map((c) => c.name),
      ...missing,
    ];
    if (waiting.length > 0) {
      return {
        state: 'pending',
        reason: `Waiting for ${waiting.join(', ')}`,
        evidence,
        recheckAt: new Date(now.getTime() + 60_000),
      };
    }
    if (considered.length === 0)
      return { state: 'pass', reason: 'No external checks are required' };
    return { state: 'pass', reason: `${considered.length} checks passed`, evidence };
  },
};

/** The scan's findings as the release reported them: { high, critical }. */
export const securityScanGate: GateDefinition = {
  name: 'security_scan',
  label: () => 'Security scan',
  async evaluate({ release }) {
    const scan = release.provenance?.['scan'];
    if (typeof scan !== 'object' || scan === null) {
      return { state: 'pending', reason: 'No security scan was reported for this release' };
    }
    const high = Number((scan as Record<string, unknown>)['high'] ?? 0);
    const critical = Number((scan as Record<string, unknown>)['critical'] ?? 0);
    if (critical + high > 0) {
      return {
        state: 'fail',
        reason: `${critical} critical and ${high} high findings`,
        evidence: { high, critical },
      };
    }
    return { state: 'pass', reason: '0 high findings', evidence: { high, critical } };
  },
};

/**
 * The canary a policy asks for is judged during the rollout, step by step, on metrics; as a
 * gate before it starts it only says so, and the plan carries the steps.
 */
export const canaryGate: GateDefinition = {
  name: 'canary',
  label: () => 'Canary',
  async evaluate() {
    return { state: 'pass', reason: 'Judged on metrics at each step of the rollout' };
  },
};
