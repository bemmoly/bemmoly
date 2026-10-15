import {
  IMPORT_TARGET_KEY_PATTERN,
  type ImportInclude,
  type ImportJob,
  type ImportPersonRow,
  type ImportPlanTargets,
  type ImportTarget,
  type UpdateImportBody,
} from '@bemmoly/shared';
import type { MockDb } from '../db.ts';
import { mockImportPeople } from '../seed/import-people.ts';
import { MOCK_IMPORT_SOURCES } from '../seed/imports.ts';
import { docsState } from './docs-state.ts';
import type { ChooserState } from './import-state.ts';
import { projectsOf } from './work-board-state.ts';

/*
 * Options and mapping as the server's plan makes them: what to bring (source defaults, then
 * the last plan, then this request), where each chosen container goes (a taken key is an error
 * unless the clash rule is suffix) and who each person becomes.
 */

interface Holder {
  id: string;
  key: string;
  name: string;
}

const UPDATE_NOTE = 'Running again updates what the last import made; nothing is copied twice.';

/** The projects or spaces here that a container could go into, or whose key it would take. */
export function holdersOf(db: MockDb, source: string): Holder[] {
  if (source === 'confluence') {
    return docsState(db).spaces.map((space) => ({
      id: space.id,
      key: space.key,
      name: space.name,
    }));
  }
  return projectsOf(db).map((row) => ({
    id: row.id,
    key: String(row['key']),
    name: String(row['name']),
  }));
}

/** "~rohan" → "ROHAN"; keys are a capital, then capitals or digits, at most 10. */
export function keyFrom(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const lead = /^[A-Z]/.test(clean) ? clean : `K${clean}`;
  return lead.padEnd(2, 'X').slice(0, 10);
}

function nextFree(base: string, taken: ReadonlySet<string>): string {
  for (let n = 2; ; n += 1) {
    const key = `${base.slice(0, 10 - String(n).length)}${n}`;
    if (!taken.has(key)) return key;
  }
}

function resolve(db: MockDb, job: ImportJob, state: ChooserState): ImportPlanTargets {
  const holders = holdersOf(db, job.source);
  const label = job.source === 'confluence' ? 'Docs space' : 'Work project';
  const records = job.source === 'confluence' ? 'pages' : 'issues';
  const container = job.source === 'confluence' ? 'space' : 'project';
  // The chooser's seed says which keys are in use ("Key in use"); the plan agrees with it.
  const free = new Set(state.rows.filter((row) => !row.keyInUse && row.key).map((row) => row.key));
  const byKey = new Map(holders.filter((row) => !free.has(row.key)).map((row) => [row.key, row]));
  const claimed = new Set<string>();
  const summary: ImportPlanTargets = { create: 0, existing: 0, update: 0, errors: 0, renamed: 0 };
  state.targets = new Map();
  for (const row of state.rows) {
    if (!state.selected.has(row.id) || row.access !== 'ok') continue;
    const request = state.requests.get(row.id);
    let target: ImportTarget;
    if (request?.mode === 'existing') {
      const into = holders.find((entry) => entry.id === request.id);
      target = {
        mode: 'existing',
        key: into?.key ?? '',
        id: request.id,
        name: into?.name ?? null,
        note: into ? `Its ${records} are numbered on from the last ${into.key} key.` : null,
        error: into ? null : `That ${label} no longer exists. Pick another.`,
      };
    } else if (!request && row.imported) {
      const { id, key, name } = row.imported;
      target = { mode: 'update', key, id, name, note: UPDATE_NOTE, error: null };
    } else {
      let key = request?.key ?? keyFrom(row.key ?? row.name);
      const holder = byKey.get(key);
      const twin = claimed.has(key);
      let note: string | null = key === row.key ? null : `The key becomes ${key}.`;
      let error: string | null = null;
      if (holder || twin) {
        const by = holder ? `${holder.name} (a ${label})` : `another chosen ${container}`;
        if (state.onClash === 'suffix') {
          const free = nextFree(key, new Set([...byKey.keys(), ...claimed]));
          note = `${key} is taken by ${by}; it becomes ${free}.`;
          key = free;
        } else {
          error = holder
            ? `${key} is taken by ${by}. Pick another key, or bring these ${records} into ${holder.name}.`
            : `${key} is also the key of ${by}. Pick another key.`;
        }
      }
      claimed.add(key);
      target = { mode: 'create', key, id: null, name: null, note, error };
    }
    state.targets.set(row.id, target);
    summary[target.mode] += 1;
    if (target.error) summary.errors += 1;
    if (target.mode === 'create' && target.key !== row.key) summary.renamed += 1;
  }
  return summary;
}

function includeOf(job: ImportJob, asked: UpdateImportBody['include']): ImportInclude {
  const options = MOCK_IMPORT_SOURCES.find((entry) => entry.id === job.source)?.options ?? [];
  const offered = new Set(options.map((option) => option.name));
  const merged: ImportInclude = {
    comments: false,
    attachments: false,
    agile: false,
    links: false,
    history: false,
    ...Object.fromEntries(options.map((option) => [option.name, option.default])),
    ...job.plan?.include,
    ...asked,
  };
  for (const key of Object.keys(merged) as (keyof ImportInclude)[]) {
    merged[key] = merged[key] && offered.has(key);
  }
  return merged;
}

/** Applies the request's choices; an error string when it names something unknown. */
export function applyChoices(
  db: MockDb,
  job: ImportJob,
  state: ChooserState,
  body: UpdateImportBody,
): string | null {
  for (const [id, request] of Object.entries(body.targets ?? {})) {
    if (request.mode === 'create' && !IMPORT_TARGET_KEY_PATTERN.test(request.key)) {
      return 'Use 2 to 10 capitals or digits';
    }
    state.requests.set(id, request);
  }
  if (!state.people) state.people = mockImportPeople(job.source, db.users);
  for (const [sourceId, choice] of Object.entries(body.people ?? {})) {
    const person = state.people.find((row) => row.sourceId === sourceId);
    const member = db.users.find((user) => user.id === choice && user.status === 'active');
    if (!person || (choice !== 'placeholder' && !member)) {
      return `${sourceId} is not a person of this import, or that member is not active`;
    }
    Object.assign<ImportPersonRow, Partial<ImportPersonRow>>(person, {
      override: true,
      userId: member?.id ?? null,
      userName: member?.name ?? null,
      match: member ? 'matched' : person.email ? 'placeholder' : 'hidden',
    });
  }
  if (body.onClash) state.onClash = body.onClash;
  return null;
}

/** The plan's echo of every choice. */
export function choicesOf(db: MockDb, job: ImportJob, state: ChooserState, body: UpdateImportBody) {
  const people = state.people ?? [];
  return {
    include: includeOf(job, body.include),
    onClash: state.onClash,
    targets: resolve(db, job, state),
    people: {
      total: people.length,
      matched: people.filter((row) => row.match === 'matched').length,
      placeholders: people.filter((row) => row.match === 'placeholder').length,
      hidden: people.filter((row) => row.match === 'hidden').length,
    },
  };
}
