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

interface ReportedCheck {
  name: string;
  conclusion: string;
}

function reportedChecks(provenance: Record<string, unknown> | null): ReportedCheck[] | null {
  const checks = provenance?.['checks'];
  if (!Array.isArray(checks)) return null;
  return checks.flatMap((check: unknown) => {
    if (typeof check !== 'object' || check === null) return [];
    const { name, conclusion } = check as Record<string, unknown>;
    return typeof name === 'string' && typeof conclusion === 'string' ? [{ name, conclusion }] : [];
  });
}

/** Required checks reported by the company's own CI with the release. */
export const externalChecksGate: GateDefinition = {
  name: 'external_checks',
  label: () => 'External checks',
  async evaluate({ release }) {
    const checks = reportedChecks(release.provenance);
    if (!checks || checks.length === 0) {
      return { state: 'pass', reason: 'No external checks are required for this release' };
    }
    const failing = checks.filter((c) => !['success', 'neutral', 'skipped'].includes(c.conclusion));
    const waiting = failing.filter((c) =>
      ['pending', 'queued', 'in_progress'].includes(c.conclusion),
    );
    if (failing.length > waiting.length) {
      const names = failing.filter((c) => !waiting.includes(c)).map((c) => c.name);
      return { state: 'fail', reason: `${names.join(', ')} failed`, evidence: { checks } };
    }
    if (waiting.length > 0) {
      return {
        state: 'pending',
        reason: `Waiting for ${waiting.map((c) => c.name).join(', ')}`,
        evidence: { checks },
      };
    }
    return { state: 'pass', reason: `${checks.length} checks passed`, evidence: { checks } };
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
