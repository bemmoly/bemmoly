/**
 * How big a server Bemmoly needs, from capacity.json, whose runs are copies of a committed
 * results file under perf/results. Every capacity number the site shows goes through here,
 * so tests/capacity.test.ts can check each one on the page against that file. A size with no
 * runs is not yet measured and shows no numbers: nothing here is extrapolated beyond the
 * written-out people assumption.
 */
import data from './capacity.json';

export type Verdict = 'fast' | 'usable' | 'slow';

interface RunBase {
  id: string;
  measured: string;
  /** Measured before the latest performance work; the page says so until a re-run. */
  preliminary: boolean;
  note?: string;
  source: string;
  verdict: Verdict;
  /** The highest load that stayed within the latency budget; null when no ramp was run. */
  requestsPerSecond: number | null;
  data: {
    issues: number;
    approximate?: boolean;
    comments?: number;
    docPages?: number;
    largestProject?: number;
    users?: number;
    projects?: number;
  };
}

/** The run with a load ramp: typical and at-limit speeds, a soak, live editing, an import. */
export interface LoadRun extends RunBase {
  requestsPerSecond: number;
  typical: {
    rps: number;
    p95Ms: { board: number; issue: number; search: number; docPage: number; issueEdit: number };
  };
  atLimitP95Ms: { board: number; issue: number };
  soak: {
    minutes: number;
    rps: number;
    requests: number;
    errors: number;
    p95Ms: [number, number];
    appMemoryMb: number;
  };
  liveEditing: { delivered: number; sent: number };
  import: { issues: number; seconds: number };
}

export interface Run extends RunBase {
  p95Ms?: Record<string, number>;
  /** Routes measured only as "under" this many milliseconds. */
  p95MsUnder?: Record<string, number>;
  p95MsAbout?: number;
  databaseGb?: number;
  finding?: string;
}

export interface ServerSize {
  cpu: number;
  ramGb: number;
  recommended: boolean;
  runs: Run[];
}

export const CAPACITY = data as {
  source: string;
  setup: string;
  assumption: { requestsPerActiveUserPerSecond: number; activeShare: number; text: string };
  sizes: ServerSize[];
};

export const sizeKey = (size: Pick<ServerSize, 'cpu' | 'ramGb'>) => `${size.cpu}-${size.ramGb}`;
export const sizeName = (size: Pick<ServerSize, 'cpu' | 'ramGb'>) =>
  `${size.cpu} vCPU, ${size.ramGb} GB`;
export const isMeasured = (size: ServerSize) => size.runs.length > 0;

export const fmt = (value: number) => value.toLocaleString('en-US');

const isLoadRun = (run: Run): run is Run & LoadRun =>
  typeof run.requestsPerSecond === 'number' && 'soak' in run;

export const RECOMMENDED = CAPACITY.sizes.find((size) => size.recommended)!;

/** The run with a measured load ramp, the only one a people figure may come from. */
export const LOAD_RUN = RECOMMENDED.runs.find(isLoadRun);

/** The largest data set the recommended size handled without slowing down: the headline. */
export const HEADLINE = [...RECOMMENDED.runs]
  .filter((run) => run.verdict !== 'slow')
  .sort((a, b) => b.data.issues - a.data.issues)[0]!;

/** The smallest data set that slowed the recommended size down, if one was run. */
export const LIMIT = RECOMMENDED.runs
  .filter((run) => run.verdict === 'slow')
  .sort((a, b) => a.data.issues - b.data.issues)[0];

/** Round down to two significant figures, so an estimate never rounds up. */
export const floorRound = (value: number) => {
  if (value <= 0) return 0;
  const step = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.floor(value / step) * step;
};

/** People a measured load serves, from the written-out assumption, rounded down. */
export function peopleOf(
  requestsPerSecond: number | null,
): { atOnce: number; organisation: number } | null {
  if (requestsPerSecond === null) return null;
  const { requestsPerActiveUserPerSecond, activeShare } = CAPACITY.assumption;
  const atOnce = floorRound(requestsPerSecond / requestsPerActiveUserPerSecond);
  return { atOnce, organisation: floorRound(atOnce / activeShare) };
}

/** The latency rows the card draws, in this order, for the routes a run recorded. */
const ROUTES = [
  ['issue', 'Open an issue'],
  ['docPage', 'Open a doc page'],
  ['search', 'Search'],
  ['pageTree', 'Page tree'],
  ['board', 'Big board'],
] as const;

export interface LatencyRow {
  label: string;
  ms: number;
  under: boolean;
}

export function latencyRows(run: Run): LatencyRow[] {
  return ROUTES.flatMap(([route, label]): LatencyRow[] => {
    const exact = run.p95Ms?.[route];
    if (exact !== undefined) return [{ label, ms: exact, under: false }];
    const under = run.p95MsUnder?.[route];
    return under === undefined ? [] : [{ label, ms: under, under: true }];
  });
}

/** The full length of a latency bar: half a second. */
export const BAR_SCALE_MS = 500;
