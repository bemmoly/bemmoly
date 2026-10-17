import type { SqlExecutor } from '@bemmoly/core';
import { createLogsService } from '../../server/src/services/logs/index.ts';
import type { LogObjects } from '../../server/src/services/logs/store.ts';
import { outputOf, recordResults, selectJobs, type OutputJob } from '../demo/job-logs.ts';

/*
 * A finished job's log and test report, sent the way a runner sends them: chunks through
 * the logs service (stored in Pipelines' object store and announced to open log views) and
 * the JUnit summary through the report ingest, so the Run page of a simulated job reads
 * like a real one, failing test and all.
 */

export function createJobLogWriter(objects: LogObjects | undefined) {
  const logs = createLogsService(objects ? { objects } : {});
  return async function writeJobLog(tx: SqlExecutor, jobId: string): Promise<void> {
    const [job] = await tx<OutputJob[]>`${selectJobs(tx)} where j.id = ${jobId}`;
    if (!job) return;
    const output = outputOf(job);
    let firstLine = 1;
    for (const [position, lines] of output.steps.entries()) {
      if (lines.length === 0) continue;
      await logs.append(tx, job, {
        seq: position,
        firstLine,
        stepPosition: position,
        lines,
        lineCount: lines.length,
      });
      await tx`update pipeline_steps set first_line = ${firstLine}, line_count = ${lines.length}
        where job_id = ${jobId} and position = ${position}`;
      firstLine += lines.length;
    }
    await recordResults(tx, job, output);
  };
}
