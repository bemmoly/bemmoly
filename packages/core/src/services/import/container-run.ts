import type { ImportCount } from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type {
  ImportContainerScope,
  ImportRunContainer,
  ImportRunContext,
} from '../../contracts/importer.ts';
import { reasonOf } from './reasons.ts';

/*
 * One container at a time, each on its own: its status, phase and counts on its row, its own
 * checkpoint (Retry carries on from there), and an error that stops it and only it. The job's
 * overall bar is the sum over containers and only grows: a phase starting never resets it.
 */

interface ContainerRecord {
  source_id: string;
  key: string | null;
  name: string;
  kind: string;
  count: number | null;
  run_status: string | null;
  run_checkpoint: unknown;
  target_mode: 'create' | 'existing' | 'update' | null;
  target_key: string | null;
  target_id: string | null;
}

export interface ContainerRunHooks {
  /** The job's overall progress grew by this many records. */
  advance(by: number): void;
  /** Writes progress when due; throws ImportCancelledError when the job was cancelled. */
  maybeFlush(): Promise<void>;
  flush(): Promise<void>;
  /** Counts and skips go to this container from now on. */
  setCurrent(id: string | null): void;
  /** What this container's run counted, by kind. */
  countsOf(id: string): Record<string, ImportCount>;
  /** "Jira", for reasons in plain words. */
  sourceLabel: string;
  /** The app path of a target key, when the importer says where it opens. */
  pathOf?: (key: string) => string;
  /** Errors that end the whole run rather than one container (cancel, abort). */
  isFatal(error: unknown): boolean;
}

export function createContainerRunner(
  sql: SqlClient,
  jobId: string,
  hooks: ContainerRunHooks,
): ImportRunContext['containers'] {
  let rows: ContainerRecord[] | null = null;

  async function load(): Promise<ContainerRecord[]> {
    rows ??= await sql<ContainerRecord[]>`
      select source_id, key, name, kind, count, run_status, run_checkpoint, target_mode,
        target_key, target_id
      from import_containers where job_id = ${jobId} and selected
      order by position`;
    return rows;
  }

  const toContainer = (row: ContainerRecord): ImportRunContainer => ({
    id: row.source_id,
    key: row.key,
    name: row.name,
    kind: row.kind,
    count: row.count,
    target: row.target_mode
      ? { mode: row.target_mode, key: row.target_key ?? '', id: row.target_id }
      : null,
  });

  const mark = (id: string) => sql`job_id = ${jobId} and source_id = ${id}`;

  function scopeOf(row: ContainerRecord): ImportContainerScope {
    const id = row.source_id;
    return {
      checkpoint: {
        read: <T>() => (row.run_checkpoint ?? null) as T | null,
        async save(value) {
          row.run_checkpoint = value;
          await sql`
            update import_containers set run_checkpoint = ${JSON.stringify(value)}::jsonb,
              updated_at = now()
            where ${mark(id)}`;
          await hooks.flush();
        },
      },
      progress: {
        async phase(name, total) {
          await sql`
            update import_containers set run_phase = ${name},
              run_total = greatest(run_total, ${Math.max(0, Math.floor(total))}),
              updated_at = now()
            where ${mark(id)}`;
          await hooks.flush();
        },
        async advance(by = 1) {
          hooks.advance(by);
          await sql`
            update import_containers set run_done = run_done + ${by},
              run_total = greatest(run_total, run_done + ${by}), updated_at = now()
            where ${mark(id)}`;
          await hooks.maybeFlush();
        },
      },
    };
  }

  return {
    async list() {
      return (await load())
        .filter((row) => row.run_status !== 'done' && row.run_status !== 'failed')
        .map(toContainer);
    },

    async done() {
      return (await load()).filter((row) => row.run_status === 'done').map(toContainer);
    },

    async run(container, work, options = {}) {
      const row = (await load()).find((entry) => entry.source_id === container.id);
      if (!row || row.run_status === 'failed' || row.run_status === 'done') return false;
      hooks.setCurrent(container.id);
      row.run_status = 'running';
      await sql`
        update import_containers set run_status = 'running', run_error = null, updated_at = now()
        where ${mark(container.id)}`;
      try {
        await work(scopeOf(row));
      } catch (error) {
        hooks.setCurrent(null);
        if (hooks.isFatal(error)) throw error;
        row.run_status = 'failed';
        await sql`
          update import_containers set run_status = 'failed', run_phase = null,
            run_error = ${reasonOf(error, hooks.sourceLabel)}, run_finished_at = now(),
            run_result = ${JSON.stringify({ counts: hooks.countsOf(container.id) })}::jsonb,
            updated_at = now()
          where ${mark(container.id)}`;
        await hooks.flush();
        return false;
      }
      hooks.setCurrent(null);
      const final = options.final !== false;
      row.run_status = final ? 'done' : 'waiting';
      const path = final && row.target_key && hooks.pathOf ? hooks.pathOf(row.target_key) : null;
      await sql`
        update import_containers set run_status = ${row.run_status},
          run_phase = ${final ? null : sql`run_phase`},
          run_checkpoint = ${final ? null : sql`run_checkpoint`},
          run_finished_at = ${final ? sql`now()` : null},
          run_result = ${JSON.stringify({ counts: hooks.countsOf(container.id), path })}::jsonb,
          updated_at = now()
        where ${mark(container.id)}`;
      await hooks.flush();
      return true;
    },
  };
}
