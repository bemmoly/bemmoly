import { pino } from 'pino';
import type { SqlClient } from '../../clients/postgres.ts';
import type {
  Changelog,
  ChangelogEntry,
  ChangelogRollbackTarget,
  ChangelogRunner,
  ChangelogRunOptions,
  ChangelogValidationProblem,
  ChangesetContextName,
  PendingChangeset,
} from '../../contracts/changelog.ts';
import { acceptChecksum, applyChangeset, decide, type ApplyState } from './apply.ts';
import type { ChangelogLogger } from './context.ts';
import { ChangelogError } from './errors.ts';
import { withChangelogLock, withConnection } from './lock.ts';
import { planChangesets, type PlannedChangeset } from './plan.ts';
import { planRollback, rollbackChangesets, selectTargets, type RollbackPlan } from './rollback.ts';
import { matchesContexts, selectSources, type ChangelogSource } from './sources.ts';
import { readHistory, tagLatest, type HistoryRow } from './store.ts';
import { historyProblems, structuralProblems } from './validate.ts';

export interface ChangelogRunnerOptions {
  sql: SqlClient;
  /** The kernel's changelog, recorded as module "core" and always applied first. */
  kernel: Changelog;
  /** Every module changelog in the image; which ones run is chosen per call. */
  modules?: readonly ChangelogSource[];
  appVersion: string;
  /** Kernel services a code changeset may call through ctx.services. */
  services?: Readonly<Record<string, unknown>>;
  logger?: ChangelogLogger;
}

export interface SelectionOptions {
  contexts?: readonly ChangesetContextName[];
  modules?: readonly string[];
}

export interface KernelChangelogRunner extends ChangelogRunner {
  status(options?: SelectionOptions): Promise<PendingChangeset[]>;
  plan(options: ChangelogRunOptions): Promise<PlannedChangeset[]>;
  history(module?: string): Promise<HistoryRow[]>;
  tag(name: string): Promise<HistoryRow>;
  /** What a rollback would do, including which steps are irreversible. */
  rollbackPlan(module: string, target: ChangelogRollbackTarget): Promise<RollbackPlan>;
}

const silent: ChangelogLogger = pino({ level: 'silent' });

export function createChangelogRunner(options: ChangelogRunnerOptions): KernelChangelogRunner {
  const { sql, kernel, appVersion } = options;
  const available = options.modules ?? [];
  const services = options.services ?? {};
  const logger = options.logger ?? silent;
  const everySource = () => selectSources(kernel, available);

  async function update(run: ChangelogRunOptions): Promise<ChangelogEntry[]> {
    const sources = selectSources(kernel, available, run.modules);
    const blocking = sources
      .flatMap((source) => structuralProblems(source.module, source.changelog))
      .filter((problem) => problem.problem !== 'missing_down');
    if (blocking.length > 0) {
      throw new ChangelogError(
        'invalid_changelog',
        `Changelog is not valid:\n${blocking.map((p) => `  - ${p.message}`).join('\n')}`,
        { details: blocking },
      );
    }
    return withChangelogLock(sql, async (connection) => {
      const rows = new Map(
        (await readHistory(connection)).map((row) => [`${row.module}/${row.id}`, row]),
      );
      const state: ApplyState = {
        connection,
        appVersion,
        contexts: run.contexts,
        services,
        logger,
        retryStarted: run.retryStarted ?? false,
      };
      const applied: ChangelogEntry[] = [];
      for (const source of sources) {
        for (const changeset of source.changelog) {
          const row = rows.get(`${source.module}/${changeset.id}`);
          const decision = decide(source.module, changeset, row, run.contexts, state.retryStarted);
          if (decision.action === 'accept_checksum') {
            await acceptChecksum(source.module, changeset, state);
          } else if (decision.action === 'run') {
            const entry = await applyChangeset(source.module, changeset, row, state);
            if (entry) applied.push(entry);
          }
        }
      }
      return applied;
    });
  }

  async function status(selection: SelectionOptions = {}): Promise<PendingChangeset[]> {
    const sources = selectSources(kernel, available, selection.modules);
    const history = await readHistory(sql);
    const done = new Set(
      history
        .filter((row) => row.state === 'ran' || row.state === 'marked_ran')
        .map((row) => `${row.module}/${row.id}`),
    );
    return sources.flatMap((source) =>
      source.changelog
        .filter((changeset) => !done.has(`${source.module}/${changeset.id}`))
        .filter(
          (changeset) => !selection.contexts || matchesContexts(changeset, selection.contexts),
        )
        .map((changeset) => ({ module: source.module, id: changeset.id })),
    );
  }

  async function validate(): Promise<ChangelogValidationProblem[]> {
    const sources = everySource();
    const history = await readHistory(sql);
    return sources.flatMap((source) => [
      ...structuralProblems(source.module, source.changelog),
      ...historyProblems(source.module, source.changelog, history),
    ]);
  }

  return {
    update,
    status,
    validate,
    plan: (run) =>
      withConnection(sql, (connection) =>
        planChangesets({
          connection,
          sources: selectSources(kernel, available, run.modules),
          contexts: run.contexts,
          services,
          logger,
        }),
      ),
    history: (module) => readHistory(sql, module),
    async tag(name) {
      return withChangelogLock(sql, async (connection) => {
        const row = await tagLatest(connection, name);
        if (!row) throw new ChangelogError('unknown_target', 'Nothing has been applied to tag');
        return row;
      });
    },
    rollback: (module, target) =>
      withChangelogLock(sql, (connection) =>
        rollbackChangesets(
          { connection, sources: everySource(), services, logger },
          module,
          target,
        ),
      ),
    async rollbackPlan(module, target) {
      const targets = selectTargets(await readHistory(sql), module, target);
      return planRollback(everySource(), targets);
    },
  };
}
