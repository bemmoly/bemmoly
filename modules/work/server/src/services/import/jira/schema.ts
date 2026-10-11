import type { SqlExecutor } from '@bemmoly/core';
import type { JiraField, JiraIssueType, JiraStatus } from '../../../clients/jira.ts';

/*
 * How Jira's configuration lands on Work's, decided the same way when the plan is shown and
 * when the run writes: issue types by name, else by level; statuses by name, else created in
 * the project's own workflow with Jira's category; custom fields by name, else created as a
 * project field when Work has a kind for them, else reported.
 */

export type WorkLevel = 'epic' | 'standard' | 'subtask';
export type WorkCategory = 'todo' | 'in_progress' | 'done';
export type WorkFieldKind =
  'text' | 'number' | 'select' | 'multiselect' | 'user' | 'date' | 'datetime' | 'url';

export interface WorkTypeRow {
  id: string;
  key: string;
  name: string;
  level: WorkLevel;
  project_id: string | null;
}

export function levelOf(type: JiraIssueType): WorkLevel {
  if (type.subtask || (type.hierarchyLevel ?? 0) < 0) return 'subtask';
  if ((type.hierarchyLevel ?? 0) > 0 || type.name.toLowerCase() === 'epic') return 'epic';
  return 'standard';
}

/** The Work type a Jira type lands on: same name, else the first of its level. */
export function matchIssueType(
  type: JiraIssueType,
  types: readonly WorkTypeRow[],
): { row: WorkTypeRow; byName: boolean } | null {
  const named = types.find((row) => row.name.toLowerCase() === type.name.toLowerCase());
  if (named) return { row: named, byName: true };
  const level = levelOf(type);
  const sameLevel = types.find((row) => row.level === level) ?? types[0];
  return sameLevel ? { row: sameLevel, byName: false } : null;
}

export function categoryOf(status: JiraStatus): WorkCategory {
  const key = status.statusCategory?.key;
  if (key === 'done') return 'done';
  if (key === 'indeterminate') return 'in_progress';
  return 'todo';
}

const SPRINT = 'com.pyxis.greenhopper.jira:gh-sprint';
const EPIC_LINK = 'com.pyxis.greenhopper.jira:gh-epic-link';
const STORY_POINTS = /^story point(s| estimate)$/i;

/** Custom fields with a home on the issue itself rather than in custom_fields. */
export type BuiltInField = 'sprint' | 'epic' | 'estimate';

export function builtInOf(field: JiraField): BuiltInField | null {
  if (field.schema?.custom === SPRINT) return 'sprint';
  if (field.schema?.custom === EPIC_LINK) return 'epic';
  if (STORY_POINTS.test(field.name)) return 'estimate';
  return null;
}

export function fieldKindOf(field: JiraField): WorkFieldKind | null {
  const schema = field.schema ?? {};
  const custom = schema.custom ?? '';
  if (custom.endsWith(':url')) return 'url';
  switch (schema.type) {
    case 'string':
      return 'text';
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime';
    case 'option':
      return 'select';
    case 'user':
      return 'user';
    case 'array':
      return schema.items === 'option' || schema.items === 'string' ? 'multiselect' : null;
    default:
      return null;
  }
}

/** "Customer Tier (old)" → "customer_tier_old", a valid Work field or type key. */
export function keyFrom(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^([^a-z])/, 'f_$1')
      .slice(0, 36) || 'field';
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}_${n}`;
  return key;
}

export async function workTypes(sql: SqlExecutor, projectId: string | null) {
  return sql<WorkTypeRow[]>`
    select id, key, name, level, project_id from issue_types
    where project_id is null or project_id = ${projectId}::uuid
    order by project_id nulls last, position, id`;
}

export async function workStatuses(sql: SqlExecutor, projectId: string | null) {
  return sql<{ id: string; name: string; category: WorkCategory; workflow_id: string }[]>`
    select s.id, s.name, s.category, s.workflow_id from workflow_statuses s
    where s.workflow_id = (
      select w.id from workflows w
      where w.project_id = ${projectId}::uuid or w.project_id is null
      order by w.project_id nulls last, w.id limit 1)
    order by s.position, s.id`;
}

export async function workFields(sql: SqlExecutor, projectId: string | null) {
  return sql<{ id: string; key: string; name: string; kind: string; project_id: string | null }[]>`
    select id, key, name, kind, project_id from fields
    where project_id is null or project_id = ${projectId}::uuid
    order by project_id nulls first, id`;
}

/** Work's project key rules: an uppercase letter, then 1–9 uppercase letters or digits. */
export function projectKeyFrom(key: string): string {
  const cleaned = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const lead = /^[A-Z]/.test(cleaned) ? cleaned : `P${cleaned}`;
  return lead.padEnd(2, 'X').slice(0, 10);
}
