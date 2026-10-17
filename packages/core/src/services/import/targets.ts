import type { ImportClashRule, ImportTarget, ImportTargetRequest } from '@bemmoly/shared';
import type { ImportTargetLookup } from '../../contracts/importer.ts';

/*
 * Where each chosen container goes. Asked for nothing, a container imported before updates
 * what that import made, and a new one gets a key from its source key. A new key that a
 * project or space here already has, or that two chosen containers would share, is an error
 * the admin fixes (another key, or Existing) or, on the wizard's short path, takes the next
 * free key with a note. It is never merged into what holds the key.
 */

export interface TargetInput {
  id: string;
  key: string | null;
  name: string;
  imported: { id: string; key: string; name: string } | null;
  request: ImportTargetRequest | null;
}

const updateNote = 'Running again updates what the last import made; nothing is copied twice.';

/** "SUP" taken → "SUP2", "SUP3"…, staying within the 10-character key rule. */
function nextFree(base: string, taken: ReadonlySet<string>): string {
  for (let n = 2; ; n += 1) {
    const suffix = String(n);
    const key = `${base.slice(0, 10 - suffix.length)}${suffix}`;
    if (!taken.has(key)) return key;
  }
}

export async function resolveTargets(
  inputs: readonly TargetInput[],
  lookup: ImportTargetLookup,
  onClash: ImportClashRule,
): Promise<Map<string, ImportTarget>> {
  const wanted = inputs.map((input) =>
    input.request?.mode === 'create' ? input.request.key : lookup.keyFrom(input.key ?? input.name),
  );
  const existingIds = inputs.flatMap((input) =>
    input.request?.mode === 'existing' ? [input.request.id] : [],
  );
  const byId = new Map((await lookup.byIds(existingIds)).map((row) => [row.id, row]));
  const holders = new Map((await lookup.byKeys(wanted)).map((row) => [row.key, row]));
  const taken = new Set(holders.keys());
  const claimed = new Map<string, string>();
  const out = new Map<string, ImportTarget>();
  for (const [index, input] of inputs.entries()) {
    const request = input.request;
    if (request?.mode === 'existing') {
      const row = byId.get(request.id);
      out.set(input.id, {
        mode: 'existing',
        key: row?.key ?? '',
        id: request.id,
        name: row?.name ?? null,
        note: row ? `Its ${lookup.records} are numbered on from the last ${row.key} key.` : null,
        error: row ? null : `That ${lookup.label} no longer exists. Pick another.`,
      });
      continue;
    }
    if (!request && input.imported) {
      out.set(input.id, {
        mode: 'update',
        key: input.imported.key,
        id: input.imported.id,
        name: input.imported.name,
        note: updateNote,
        error: null,
      });
      continue;
    }
    let key = wanted[index]!;
    const holder = holders.get(key);
    const twin = claimed.get(key);
    let note: string | null = key === input.key ? null : `The key becomes ${key}.`;
    let error: string | null = null;
    if (holder || twin) {
      const by = holder
        ? `${holder.name} (a ${lookup.label})`
        : `another chosen ${lookup.container}`;
      if (onClash === 'suffix') {
        const free = nextFree(key, new Set([...taken, ...claimed.keys()]));
        note = `${key} is taken by ${by}; it becomes ${free}.`;
        key = free;
      } else {
        error = holder
          ? `${key} is taken by ${by}. Pick another key, or bring these ${lookup.records} into ${holder.name}.`
          : `${key} is also the key of ${by}. Pick another key.`;
      }
    }
    claimed.set(key, input.id);
    out.set(input.id, { mode: 'create', key, id: null, name: null, note, error });
  }
  return out;
}
