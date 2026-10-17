import {
  importPeopleQuerySchema,
  runImportBodySchema,
  updateImportBodySchema,
  type CreateImportBody,
  type ImportJob,
} from '@bemmoly/shared';
import { can, type MockDb } from '../db.ts';
import { mockContainers } from '../seed/import-containers.ts';
import { MOCK_IMPORT_SOURCES, mockDiscovery, mockMappings } from '../seed/imports.ts';
import { newId } from '../seed/time.ts';
import { byNeed } from '../seed/import-people.ts';
import { bodyOf, fail, invalid, notFound, ok, type MockRoute } from '../types.ts';
import { applyChoices, choicesOf, holdersOf } from './import-plan.ts';
import { advanceRun, skipsCsv, startRun } from './import-run.ts';
import {
  chooserOf,
  findJob as find,
  listOf,
  matching,
  rowOf,
  startChooser,
} from './import-state.ts';

const SETTINGS = 'workspace.settings.manage';
/** Each read of a running job moves it on by this share of its total, as a worker would. */
const STEP = 0.34;

const adminOnly =
  (handle: MockRoute['handle']): MockRoute['handle'] =>
  (request, db) =>
    can(db, SETTINGS) ? handle(request, db) : fail(403, 'forbidden', 'You cannot do that.');

function enabledSources(db: MockDb) {
  const on = new Set(db.adminModules.filter((m) => m.enabled).map((m) => m.id));
  return MOCK_IMPORT_SOURCES.filter((source) => on.has(source.moduleId));
}

/** Moves a queued or running job one step, finishing it with a report at the end. */
function advance(job: ImportJob) {
  if (job.status === 'queued') {
    job.status = 'running';
    job.startedAt = new Date().toISOString();
  }
  if (job.status !== 'running') return;
  const total = job.progress.total;
  job.progress.done = Math.min(total, job.progress.done + Math.ceil(total * STEP));
  job.phase = job.progress.done < total / 2 ? 'People' : 'Issues';
  if (job.progress.done < total) return;
  const update = job.runs > 1;
  job.status = 'completed';
  job.phase = null;
  job.finishedAt = new Date().toISOString();
  const issues = Math.max(0, total - 6);
  job.report = {
    counts: {
      people: { created: update ? 0 : 3, updated: update ? 3 : 0, skipped: 1 },
      issues: { created: update ? 0 : issues, updated: update ? issues : 0, skipped: 5 },
    },
    skipped: [
      { kind: 'issue', source: 'PLT-14', reason: 'No title' },
      { kind: 'issue', source: 'PLT-90', reason: 'Attachment larger than 25 MB' },
      { kind: 'person', source: 'old.contractor', reason: 'Account deactivated' },
    ],
    skippedTotal: 6,
    warnings: ['Custom field "Story points (old)" was reported, not imported.'],
  };
}

export const importRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/admin/import-sources',
    handle: adminOnly((_request, db) => ok({ items: enabledSources(db) })),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/imports',
    handle: adminOnly((_request, db) => ok({ items: listOf(db).slice(0, 50) })),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/imports',
    handle: adminOnly((request, db) => {
      const body = bodyOf<CreateImportBody>(request);
      const source = enabledSources(db).find((entry) => entry.id === body.source);
      if (!source) return fail(400, 'validation_failed', 'That import source is not offered.');
      const values = body.values ?? {};
      if (values['token'] === 'wrong') {
        return fail(
          400,
          'validation_failed',
          `${source.label} refused the credentials; check the email and token`,
        );
      }
      const connection: ImportJob['connection'] = {};
      for (const field of source.fields) {
        const value = values[field.name];
        if (value === undefined || field.kind === 'file') continue;
        connection[field.name] = field.kind === 'secret' ? true : value;
      }
      const site = (values['siteUrl'] ?? '').replace(/^https?:\/\//, '') || source.label;
      const rows = mockContainers(source.id, site);
      const job: ImportJob = {
        id: newId(),
        source: source.id,
        sourceLabel: source.label,
        status: 'ready',
        phase: null,
        progress: { done: 0, total: 0 },
        connection,
        discovery: mockDiscovery(source.id, site, rows),
        plan: null,
        report: { counts: {}, skipped: [], skippedTotal: 0, warnings: [] },
        error: null,
        runs: 0,
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      };
      startChooser(job.id, rows, site.includes('flaky'));
      listOf(db).unshift(job);
      return ok(job, 201);
    }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/imports/:id',
    handle: adminOnly((request, db) => {
      const job = find(db, request.params['id']);
      if (!job) return notFound('Import');
      const state = chooserOf(job.id);
      if (job.status === 'queued') {
        job.status = 'running';
        job.startedAt = new Date().toISOString();
      } else if (job.status === 'running' && state?.progress.size) advanceRun(job, state);
      else advance(job);
      return ok(job);
    }),
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/admin/imports/:id',
    handle: adminOnly((request, db) => {
      const job = find(db, request.params['id']);
      const state = chooserOf(job?.id);
      if (!job?.discovery || !state) return notFound('Import');
      const parsed = updateImportBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) return invalid('body', parsed.error.message);
      const body = parsed.data;
      if (body.containers) state.selected = new Set(body.containers);
      const chosen = state.rows.filter((c) => state.selected.has(c.id) && c.access === 'ok');
      if (chosen.length === 0) {
        return fail(400, 'validation_failed', 'Choose at least one to bring in.');
      }
      const refused = applyChoices(db, job, state, body);
      if (refused) return fail(400, 'validation_failed', refused);
      const records = chosen.reduce((sum, c) => sum + c.records, 0);
      job.plan = {
        containers: chosen.map((c) => c.id),
        counts: { [chosen[0]?.kind === 'space' ? 'pages' : 'issues']: records },
        mappings: mockMappings(job.source),
        ...choicesOf(db, job, state, body),
      };
      const attention = matching(state, undefined, 'attention').map((row) => rowOf(state, row));
      return ok({ ...job, attention });
    }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/imports/:id/targets',
    handle: adminOnly((request, db) => {
      const job = find(db, request.params['id']);
      if (!job) return notFound('Import');
      const q = (request.query.get('q') ?? '').toLowerCase();
      const items = holdersOf(db, job.source)
        .filter((row) => !q || `${row.key} ${row.name}`.toLowerCase().includes(q))
        .map(({ id, key, name }) => ({ id, key, name }));
      return ok({ items });
    }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/imports/:id/people',
    handle: adminOnly((request) => {
      const state = chooserOf(request.params['id']);
      if (!state) return notFound('Import');
      const parsed = importPeopleQuerySchema.safeParse(Object.fromEntries(request.query));
      if (!parsed.success) return invalid('query', parsed.error.message);
      const rows = [...(state.people ?? [])].sort(byNeed);
      const from = parsed.data.cursor ? Number(parsed.data.cursor) : 0;
      const to = from + parsed.data.limit;
      return ok({ items: rows.slice(from, to), next: to < rows.length ? String(to) : null });
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/imports/:id/run',
    handle: adminOnly((request, db) => {
      const job = find(db, request.params['id']);
      if (!job?.plan) return notFound('Import');
      if (job.plan.targets?.errors) {
        return fail(400, 'validation_failed', 'Fix the keys marked in Options first.');
      }
      const parsed = runImportBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) return invalid('body', parsed.error.message);
      const state = chooserOf(job.id);
      if (state) startRun(job, state, parsed.data.containers);
      job.status = 'queued';
      job.error = null;
      job.finishedAt = null;
      job.runs += 1;
      return ok(job);
    }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/imports/:id/skips.csv',
    handle: adminOnly((request, db) => {
      if (!find(db, request.params['id'])) return notFound('Import');
      return {
        status: 200,
        body: skipsCsv(),
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="import-skipped.csv"',
        },
      };
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/imports/:id/cancel',
    handle: adminOnly((request, db) => {
      const job = find(db, request.params['id']);
      if (!job) return notFound('Import');
      job.status = 'cancelled';
      job.finishedAt = new Date().toISOString();
      return ok(job);
    }),
  },
];
