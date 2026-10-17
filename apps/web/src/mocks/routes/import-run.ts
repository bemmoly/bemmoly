import type { ImportContainerRow, ImportJob } from '@bemmoly/shared';
import type { ChooserState } from './import-state.ts';

type Progress = NonNullable<ImportContainerRow['progress']>;

/** Each read of a running job moves it on by this share of the whole run, as a worker would. */
const STEP = 0.34;
/** On a "flaky" site Mobile apps stops here the first time, as Jira's rate limit would stop it. */
const FAIL_AT = 1903;
const RATE_LIMITED = 'Jira kept answering "too many requests" for 10 minutes';

const SKIPPED = [
  { kind: 'issue', source: 'PLT-90', reason: 'Attachment larger than 25 MB' },
  { kind: 'issue', source: 'SUP-14', reason: 'No summary' },
  { kind: 'person', source: 'old.contractor', reason: 'Account deactivated' },
];
const SKIPPED_TOTAL = 37;

const chosenOf = (job: ImportJob, state: ChooserState) =>
  state.rows.filter((row) => job.plan?.containers.includes(row.id));

/** Where what it made opens: the target's key when the plan gave one. */
function pathOf(state: ChooserState, id: string, kind: string, key: string | null) {
  const target = state.targets?.get(id)?.key ?? key ?? id;
  return kind === 'space' ? `/docs/s/${target}` : `/work/board/${target}`;
}

function summarise(job: ImportJob, state: ChooserState) {
  const all = [...state.progress.values()];
  job.progress = {
    done: all.reduce((sum, p) => sum + p.done, 0),
    total: all.reduce((sum, p) => sum + p.total, 0),
  };
  const of = (status: Progress['status']) => all.filter((p) => p.status === status).length;
  job.containers = {
    total: all.length,
    waiting: of('waiting'),
    running: of('running'),
    done: of('done'),
    failed: of('failed'),
  };
}

/**
 * Starts a run: everything chosen (a re-run starts each from nothing and updates what it made),
 * or only `ids` again, each from where it stopped.
 */
export function startRun(job: ImportJob, state: ChooserState, ids?: readonly string[]) {
  const update = job.runs > 0 && !ids;
  for (const row of chosenOf(job, state)) {
    const was = state.progress.get(row.id);
    if (ids && !ids.includes(row.id)) continue;
    state.progress.set(row.id, {
      status: 'waiting',
      phase: null,
      done: ids && was ? was.done : 0,
      total: row.records,
      error: null,
      counts: update || (ids && was) ? { ...was?.counts } : {},
      path: pathOf(state, row.id, row.kind, row.key),
    });
  }
  state.updating = update;
  state.retried = state.retried || Boolean(ids);
  summarise(job, state);
}

function finish(job: ImportJob, state: ChooserState) {
  const all = [...state.progress.values()];
  const failed = all.some((p) => p.status === 'failed');
  job.status = failed ? 'completed_with_errors' : 'completed';
  job.phase = null;
  job.finishedAt = new Date().toISOString();
  const issues = all.reduce((sum, p) => sum + p.done, 0);
  const made = state.updating ? 'updated' : 'created';
  const other = state.updating ? 'created' : 'updated';
  const kind = (n: number, skipped: number) => ({ [made]: n, [other]: 0, skipped }) as never;
  const records = state.rows[0]?.kind === 'space' ? 'pages' : 'issues';
  job.report = {
    counts: {
      [records]: kind(issues, 12),
      comments: kind(Math.round(issues * 1.79), 3),
      attachments: kind(Math.round(issues * 0.26), 22),
    },
    skipped: SKIPPED,
    skippedTotal: SKIPPED_TOTAL,
    warnings: [],
  };
}

/** Moves the run one step: the next containers take this read's share, in order. */
export function advanceRun(job: ImportJob, state: ChooserState) {
  let budget = Math.max(1, Math.ceil(job.progress.total * STEP));
  for (const [id, p] of state.progress) {
    if (p.status === 'done' || p.status === 'failed') continue;
    if (budget <= 0) break;
    p.status = 'running';
    p.phase = 'Issues';
    const fails =
      state.partial && !state.retried && state.rows.find((r) => r.id === id)?.key === 'MOB';
    const stop = fails ? Math.min(FAIL_AT, p.total) : p.total;
    const step = Math.min(budget, stop - p.done);
    p.done += step;
    budget -= step;
    const made = state.updating ? 'updated' : 'created';
    const records = state.rows[0]?.kind === 'space' ? 'pages' : 'issues';
    const skipped = id.endsWith('1') ? 0 : 2;
    p.counts = { [records]: { created: 0, updated: 0, [made]: p.done, skipped } };
    if (p.done < stop) continue;
    p.phase = null;
    if (fails) {
      p.status = 'failed';
      p.error = RATE_LIMITED;
    } else p.status = 'done';
  }
  summarise(job, state);
  job.phase = 'Issues';
  if (![...state.progress.values()].some((p) => p.status === 'waiting' || p.status === 'running')) {
    finish(job, state);
  }
}

/** The full skipped list, as the CSV download serves it. */
export function skipsCsv(): string {
  const rows = Array.from({ length: SKIPPED_TOTAL }, (_, i) => {
    const skip = SKIPPED[i % SKIPPED.length] ?? SKIPPED[0];
    return `${skip?.kind},${i < SKIPPED.length ? skip?.source : `PLT-${200 + i}`},"${skip?.reason}"`;
  });
  return ['kind,source,reason', ...rows].join('\n') + '\n';
}
