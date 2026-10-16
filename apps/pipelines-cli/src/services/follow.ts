import type { Job, LogLine, RunDetail } from '@bemmoly/module-pipelines/shared';
import { CliError } from '../cli/errors.ts';
import type { PipelinesClient } from '../clients/pipelines.ts';

/*
 * Following a run's or a job's log. Polls the range endpoint once a second from the last
 * line printed, so a coalesced or dropped live event can never lose a line; the stream topic
 * only says that something changed, and a poll is what reads it.
 */

const RUN_DONE = new Set(['passed', 'failed', 'cancelled', 'skipped']);
const POLL_MS = 1000;

export interface FollowOptions {
  client: PipelinesClient;
  print(line: string): void;
  sleep(ms: number): Promise<void>;
  follow: boolean;
  tail?: number | undefined;
}

const lineText = (line: LogLine, prefix: string) => `${prefix}${line.text}`;

/** Prints a job's lines after `seen`; returns the last line printed and whether it is done. */
async function printJob(options: FollowOptions, jobId: string, seen: number, prefix: string) {
  const first = seen === 0 && options.tail ? { tail: options.tail } : { from: seen + 1 };
  const range = await options.client.logs(jobId, first);
  let last = seen;
  for (const line of range.lines) {
    if (line.number <= last) continue;
    options.print(lineText(line, prefix));
    last = line.number;
  }
  // A long log comes back a page at a time: `more` says another read is due now.
  const more = range.lines.length > 0 && last < range.totalLines;
  return { last, more, complete: range.complete && last >= range.totalLines };
}

export async function followJob(options: FollowOptions, jobId: string): Promise<void> {
  let seen = 0;
  for (;;) {
    const { last, more, complete } = await printJob(options, jobId, seen, '');
    seen = last;
    if (more) continue;
    if (complete || !options.follow) return;
    await options.sleep(POLL_MS);
  }
}

const header = (job: Job) => `== ${job.name}: ${job.state}`;

/** Every job of the run in order, each from where it left off; returns the final run. */
export async function followRun(options: FollowOptions, runId: string): Promise<RunDetail> {
  const seen = new Map<string, number>();
  const announced = new Set<string>();
  for (;;) {
    const run = await options.client.run(runId);
    for (const job of run.jobs) {
      if (job.state === 'pending' || job.state === 'ready') continue;
      if (!announced.has(job.id)) {
        options.print(header(job));
        announced.add(job.id);
      }
      const prefix = run.jobs.length > 1 ? `[${job.key}] ` : '';
      let page = await printJob(options, job.id, seen.get(job.id) ?? 0, prefix);
      while (page.more) page = await printJob(options, job.id, page.last, prefix);
      seen.set(job.id, page.last);
    }
    if (RUN_DONE.has(run.state) || !options.follow) return run;
    await options.sleep(POLL_MS);
  }
}

/** A run id or a job id: whichever the server knows. */
export async function kindOfId(client: PipelinesClient, id: string): Promise<'run' | 'job'> {
  try {
    await client.run(id);
    return 'run';
  } catch (error) {
    if (error instanceof CliError && error.options.status === 404) return 'job';
    throw error;
  }
}
