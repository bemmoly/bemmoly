/**
 * The sizing estimator's rule, kept pure so tests/estimate.test.ts can hold it to the data. A
 * size is recommended only from its own measured runs: the smallest size whose runs that did
 * not slow down reached at least the issues and the doc pages asked for. When no measured run
 * covers the request, the answer says "not yet measured" and names the next size up from the
 * largest one measured, with no figure for it.
 */
import { fmt, sizeName, type Run, type ServerSize } from '../data/capacity.ts';

/** The issue counts the slider steps through, roughly logarithmic. */
export const ISSUE_STOPS = [
  1_000, 5_000, 10_000, 20_000, 30_000, 50_000, 75_000, 100_000, 150_000, 200_000, 250_000, 300_000,
  400_000, 500_000,
] as const;

/** The doc page counts the slider steps through. */
export const PAGE_STOPS = [
  50, 100, 200, 400, 1_000, 2_500, 5_000, 10_000, 20_000, 30_000, 40_000,
] as const;

export interface Coverage {
  issues: number;
  pages: number;
}

/** How far a size's runs that did not slow down reach; null for a size never measured. */
export function coverageOf(size: ServerSize): Coverage | null {
  const good = size.runs.filter((run) => run.verdict !== 'slow');
  if (good.length === 0) return null;
  return {
    issues: Math.max(...good.map((run) => run.data.issues)),
    pages: Math.max(0, ...good.flatMap((run) => run.data.docPages ?? [])),
  };
}

export type Reason =
  | { kind: 'measured'; run: Run }
  | { kind: 'slow'; at: ServerSize; run: Run }
  | { kind: 'beyond'; at: ServerSize; coverage: Coverage; over: 'issues' | 'pages' | 'both' };

export interface Estimate {
  /** The size to plan for, or null when the request is beyond every listed size. */
  size: ServerSize | null;
  measured: boolean;
  reason: Reason;
  /** Smaller sizes that might be enough but are not yet measured. */
  smallerUnmeasured: ServerSize[];
}

/** The smallest run of a size that did not slow down and reaches the request. */
const coveringRun = (size: ServerSize, issues: number) =>
  size.runs
    .filter((run) => run.verdict !== 'slow' && run.data.issues >= issues)
    .sort((a, b) => a.data.issues - b.data.issues)[0];

export function estimate(sizes: readonly ServerSize[], issues: number, pages: number): Estimate {
  const index = sizes.findIndex((size) => {
    const coverage = coverageOf(size);
    return coverage !== null && issues <= coverage.issues && pages <= coverage.pages;
  });
  if (index >= 0) {
    const size = sizes[index]!;
    return {
      size,
      measured: true,
      reason: { kind: 'measured', run: coveringRun(size, issues)! },
      smallerUnmeasured: sizes.slice(0, index).filter((s) => s.runs.length === 0),
    };
  }
  const lastMeasured = sizes.findLastIndex((size) => size.runs.length > 0);
  const at = sizes[lastMeasured]!;
  const slow = at.runs
    .filter((run) => run.verdict === 'slow' && run.data.issues <= issues)
    .sort((a, b) => b.data.issues - a.data.issues)[0];
  const coverage = coverageOf(at) ?? { issues: 0, pages: 0 };
  const overIssues = issues > coverage.issues;
  const overPages = pages > coverage.pages;
  return {
    size: sizes[lastMeasured + 1] ?? null,
    measured: false,
    reason: slow
      ? { kind: 'slow', at, run: slow }
      : {
          kind: 'beyond',
          at,
          coverage,
          over: overIssues && overPages ? 'both' : overIssues ? 'issues' : 'pages',
        },
    smallerUnmeasured: [],
  };
}

const about = (run: Run) => (run.data.approximate ? 'about ' : '');

/** The sentence under the recommendation. */
export function explain(result: Estimate): string {
  const { reason } = result;
  if (reason.kind === 'measured') {
    const { run } = reason;
    const speed =
      run.verdict === 'fast' && run.requestsPerSecond !== null
        ? `ran fast at ${run.requestsPerSecond} requests a second`
        : 'stayed usable';
    const smaller = result.smallerUnmeasured.map(sizeName).join(' and ');
    return (
      `Measured: with ${about(run)}${fmt(run.data.issues)} issues it ${speed}.` +
      (smaller ? ` ${smaller} is not yet measured, so it is not recommended.` : '')
    );
  }
  const next = result.size ? `${sizeName(result.size)} is the next size up` : 'No larger size';
  const tail = result.size ? ', and it is not yet measured.' : ' is listed yet.';
  if (reason.kind === 'slow') {
    return (
      `At ${about(reason.run)}${fmt(reason.run.data.issues)} issues, ${sizeName(reason.at)} ` +
      `was measured slow. ${next}${tail}`
    );
  }
  const reach = {
    issues: `${fmt(reason.coverage.issues)} issues`,
    pages: `${fmt(reason.coverage.pages)} doc pages`,
    both: `${fmt(reason.coverage.issues)} issues and ${fmt(reason.coverage.pages)} doc pages`,
  }[reason.over];
  return `${sizeName(reason.at)} was measured up to ${reach}. ${next}${tail}`;
}

/** The slider's spoken value. */
export const issuesText = (issues: number) => `${fmt(issues)} issues`;
export const pagesText = (pages: number) => `${fmt(pages)} doc pages`;
