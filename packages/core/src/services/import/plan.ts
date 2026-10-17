import { createHash } from 'node:crypto';
import {
  ValidationError,
  type ImportClashRule,
  type ImportInclude,
  type ImportPlan,
  type ImportPlanTargets,
  type UpdateImportBody,
} from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Importer, ImportPlanContext } from '../../contracts/importer.ts';
import type { ImportConnection } from '../../contracts/importer.ts';
import { containerRefs, saveCounts } from './containers.ts';
import { overridePeople, peopleSummary, storePeople } from './people-plan.ts';
import type { ImportJobRow } from './store.ts';
import { resolveTargets, type TargetInput } from './targets.ts';

/*
 * PATCH /admin/imports/:id, as one plan: the chosen containers counted and planned at the
 * source (types, statuses, fields and people; done again only when the choice changed), then
 * what to bring, where each container goes and who each person is, which are decided here
 * and cost no call to the source.
 */

export interface PlanInput {
  sql: SqlClient;
  importer: Importer;
  connection: ImportConnection;
  ctx: () => ImportPlanContext;
  row: ImportJobRow;
  body: UpdateImportBody;
}

const NONE: ImportInclude = {
  comments: false,
  attachments: false,
  agile: false,
  links: false,
  history: false,
};

/** The source's defaults, then the last plan's choices, then this request's. */
export function includeOf(
  importer: Importer,
  previous: Partial<ImportInclude> | undefined,
  asked: Partial<ImportInclude> | undefined,
): ImportInclude {
  const offered = new Set((importer.options ?? []).map((option) => option.name));
  const defaults = Object.fromEntries(
    (importer.options ?? []).map((option) => [option.name, option.default]),
  );
  const merged = { ...NONE, ...defaults, ...previous, ...asked };
  for (const key of Object.keys(asked ?? {})) {
    if (!offered.has(key as keyof ImportInclude)) {
      throw new ValidationError(`${importer.label} has no "${key}" option`);
    }
  }
  return Object.fromEntries(
    Object.entries(merged).map(([key, on]) => [key, on && offered.has(key as keyof ImportInclude)]),
  ) as ImportInclude;
}

async function storeTargets(
  input: PlanInput,
  onClash: ImportClashRule,
): Promise<ImportPlanTargets> {
  const { sql, importer, row } = input;
  const id = row.id;
  for (const [sourceId, request] of Object.entries(input.body.targets ?? {})) {
    await sql`
      update import_containers set target_request = ${JSON.stringify(request)}::jsonb
      where job_id = ${id} and source_id = ${sourceId}`;
  }
  const rows = await sql<
    {
      source_id: string;
      key: string | null;
      name: string;
      imported_target_id: string | null;
      imported_key: string | null;
      imported_name: string | null;
      target_request: TargetInput['request'];
    }[]
  >`
    select source_id, key, name, imported_target_id, imported_key, imported_name, target_request
    from import_containers where job_id = ${id} and selected order by position`;
  if (!importer.targets) {
    return { create: rows.length, existing: 0, update: 0, errors: 0, renamed: 0 };
  }
  const resolved = await resolveTargets(
    rows.map((entry) => ({
      id: entry.source_id,
      key: entry.key,
      name: entry.name,
      imported: entry.imported_target_id
        ? {
            id: entry.imported_target_id,
            key: entry.imported_key ?? '',
            name: entry.imported_name ?? '',
          }
        : null,
      request: entry.target_request,
    })),
    importer.targets,
    onClash,
  );
  const records = [...resolved.entries()].map(([source_id, target]) => ({
    source_id,
    mode: target.mode,
    key: target.key,
    id: target.id,
    name: target.name,
    note: target.note,
    error: target.error,
  }));
  await sql`
    update import_containers c set target_mode = r.mode, target_key = r.key,
      target_id = r.id, target_name = r.name, target_note = r.note, target_error = r.error,
      updated_at = now()
    from jsonb_to_recordset(${JSON.stringify(records)}::jsonb) as r(source_id text, mode text,
      key text, id uuid, name text, note text, error text)
    where c.job_id = ${id} and c.source_id = r.source_id`;
  const sources = new Map(rows.map((entry) => [entry.source_id, entry.key]));
  const summary: ImportPlanTargets = { create: 0, existing: 0, update: 0, errors: 0, renamed: 0 };
  for (const [sourceId, target] of resolved) {
    summary[target.mode] += 1;
    if (target.error) summary.errors += 1;
    if (target.mode === 'create' && target.key !== sources.get(sourceId)) summary.renamed += 1;
  }
  return summary;
}

export async function buildPlan(input: PlanInput): Promise<ImportPlan> {
  const { sql, importer, row, body } = input;
  const previous = row.plan;
  const uncounted = await containerRefs(sql, row.id, 'selected', true);
  if (uncounted.length && importer.count) {
    await saveCounts(sql, row.id, await importer.count(input.connection, uncounted, input.ctx()));
  }
  const chosen = await containerRefs(sql, row.id, 'selected');
  if (!chosen.length) throw new ValidationError('Choose at least one to bring in');
  const choice = createHash('sha256')
    .update(chosen.map((container) => `${container.id}:${container.count ?? ''}`).join('\n'))
    .digest('base64url');
  const fresh = !previous || previous.choice !== choice;
  const source = fresh
    ? await importer.plan(input.connection, chosen, input.ctx())
    : { containers: previous.containers, counts: previous.counts, mappings: previous.mappings };
  if (fresh && importer.people) {
    const people = await importer.people(input.connection, chosen, input.ctx());
    await sql.begin((tx) => storePeople(tx, row.id, people));
  }
  if (body.people) {
    const unknown = await sql.begin((tx) => overridePeople(tx, row.id, body.people ?? {}));
    if (unknown.length) {
      throw new ValidationError(
        `${unknown.slice(0, 3).join(', ')} is not a person of this import, or that member is not active`,
      );
    }
  }
  const onClash = body.onClash ?? previous?.onClash ?? 'error';
  return {
    containers: source.containers,
    counts: source.counts,
    mappings: source.mappings,
    choice,
    include: includeOf(importer, previous?.include, body.include),
    onClash,
    targets: await storeTargets(input, onClash),
    people: await peopleSummary(sql, row.id),
  };
}
