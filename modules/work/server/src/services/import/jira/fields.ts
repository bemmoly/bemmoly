import type { ImportRunContext, SqlClient } from '@bemmoly/core';
import { fromAdf, plainText } from '@bemmoly/editor/convert';
import type { JiraField, JiraUser } from '../../../clients/jira.ts';
import {
  builtInOf,
  fieldKindOf,
  keyFrom,
  workFields,
  type BuiltInField,
  type WorkFieldKind,
} from './schema.ts';

/*
 * Custom field values. A Jira field matched by name to a Work field writes under that field's
 * key; one Work has a kind for becomes a project field the first time an issue uses it, with
 * select options added as values appear; one Work cannot hold is reported once, not per issue.
 */

interface FieldTarget {
  key: string;
  kind: WorkFieldKind | string;
  id: string | null;
  options: Map<string, string>;
}

export type PersonMatcher = (user: JiraUser | null | undefined) => Promise<string | null>;

const optionKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'option';

export function createFieldMapper(
  sql: SqlClient,
  projectId: string,
  jiraFields: readonly JiraField[],
  ctx: ImportRunContext,
) {
  const builtIns = new Map<string, BuiltInField>();
  const custom = jiraFields.filter((field) => field.custom);
  for (const field of custom) {
    const builtIn = builtInOf(field);
    if (builtIn) builtIns.set(field.id, builtIn);
  }
  let targets: Map<string, FieldTarget> | null = null;
  const reported = new Set<string>();

  async function load(): Promise<Map<string, FieldTarget>> {
    if (targets) return targets;
    const rows = await workFields(sql, projectId);
    const byName = new Map(rows.map((row) => [row.name.toLowerCase(), row]));
    targets = new Map();
    for (const field of custom) {
      const row = byName.get(field.name.toLowerCase());
      if (row)
        targets.set(field.id, { key: row.key, kind: row.kind, id: row.id, options: new Map() });
    }
    return targets;
  }

  async function create(field: JiraField, kind: WorkFieldKind): Promise<FieldTarget> {
    const rows = await workFields(sql, projectId);
    const key = keyFrom(field.name, new Set(rows.map((row) => row.key)));
    const [row] = await sql<{ id: string; key: string }[]>`
      insert into fields (project_id, key, name, kind, options)
      values (${projectId}, ${key}, ${field.name.slice(0, 60)}, ${kind}, '[]'::jsonb)
      on conflict (project_id, key) where project_id is not null do update set updated_at = fields.updated_at
      returning id, key`;
    ctx.report.count('fields', 'created');
    return { key: row!.key, kind, id: row!.id, options: new Map() };
  }

  async function addOptions(target: FieldTarget, labels: readonly string[]): Promise<string[]> {
    if (!target.id) return [];
    if (!target.options.size) {
      const [row] = await sql<
        { options: { value: string; label: string }[] }[]
      >`select options from fields where id = ${target.id}`;
      for (const option of row?.options ?? [])
        target.options.set(option.label.toLowerCase(), option.value);
    }
    const added: { value: string; label: string }[] = [];
    const values = labels.map((label) => {
      const known = target.options.get(label.toLowerCase());
      if (known) return known;
      const taken = new Set(target.options.values());
      let value = optionKey(label);
      for (let n = 2; taken.has(value); n += 1) value = `${optionKey(label).slice(0, 56)}_${n}`;
      target.options.set(label.toLowerCase(), value);
      added.push({ value, label: label.slice(0, 60) });
      return value;
    });
    if (added.length) {
      await sql`update fields set options = options || ${JSON.stringify(added)}::jsonb, updated_at = now() where id = ${target.id}`;
    }
    return values;
  }

  async function convert(
    target: FieldTarget,
    raw: unknown,
    people: PersonMatcher,
  ): Promise<unknown> {
    switch (target.kind) {
      case 'text': {
        const text = typeof raw === 'string' ? raw : plainText(fromAdf(raw));
        return text.slice(0, 10_000) || undefined;
      }
      case 'number':
        return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
      case 'date':
        return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)
          ? raw.slice(0, 10)
          : undefined;
      case 'datetime': {
        const at =
          typeof raw === 'string' ? Date.parse(raw.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')) : NaN;
        return Number.isNaN(at) ? undefined : new Date(at).toISOString();
      }
      case 'url':
        return typeof raw === 'string' && /^https?:\/\//.test(raw) ? raw : undefined;
      case 'user':
        return (await people(raw as JiraUser)) ?? undefined;
      case 'select': {
        const label = typeof raw === 'string' ? raw : (raw as { value?: string } | null)?.value;
        return label ? (await addOptions(target, [label]))[0] : undefined;
      }
      case 'multiselect': {
        const labels = (Array.isArray(raw) ? raw : [])
          .map((item) => (typeof item === 'string' ? item : (item as { value?: string })?.value))
          .filter((label): label is string => Boolean(label));
        return labels.length ? await addOptions(target, labels) : undefined;
      }
      default:
        return undefined;
    }
  }

  return {
    builtIns,
    /** The issue's custom_fields, creating fields and options the first time they are used. */
    async valuesFor(
      fields: Record<string, unknown>,
      people: PersonMatcher,
    ): Promise<Record<string, unknown>> {
      const out: Record<string, unknown> = {};
      const known = await load();
      for (const field of custom) {
        const raw = fields[field.id];
        if (raw === null || raw === undefined || builtIns.has(field.id)) continue;
        if (Array.isArray(raw) && raw.length === 0) continue;
        let target = known.get(field.id);
        if (!target) {
          const kind = fieldKindOf(field);
          if (!kind) {
            if (!reported.has(field.id)) {
              reported.add(field.id);
              ctx.report.skip(
                'field',
                field.name,
                'Work has no field of this kind; its values were not imported',
              );
            }
            continue;
          }
          target = await create(field, kind);
          known.set(field.id, target);
        }
        const value = await convert(target, raw, people);
        if (value !== undefined) out[target.key] = value;
      }
      return out;
    },
  };
}

export type FieldMapper = ReturnType<typeof createFieldMapper>;
