import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type {
  AutomationAction,
  AutomationRule,
  AutomationRun,
  AutomationRunStatus,
  AutomationTrigger,
} from '../../../../shared/index.ts';

export interface RuleRow {
  id: string;
  project_id: string | null;
  name: string;
  enabled: boolean;
  is_draft: boolean;
  trigger: Required<AutomationTrigger>;
  conditions: string[];
  actions: Required<AutomationAction>[];
  created_by: string | null;
  owner_id: string | null;
  owner_name: string | null;
  ai_run_id: string | null;
  last_scheduled_at: Date | string | null;
  last_run_at: Date | string | null;
  last_run_status: AutomationRunStatus | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface RunRow {
  id: string;
  rule_id: string;
  rule_name: string;
  status: AutomationRunStatus;
  trigger: string;
  issue_id: string | null;
  issue_key: string | null;
  depth: number;
  input: Record<string, unknown>;
  result: unknown;
  error: string | null;
  duration_ms: number | null;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  created_at: Date | string;
}

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);

/** Rules with their owner's name and their latest run, in one statement. */
export const RULE_SELECT = `
  select r.*, u.name as owner_name, last.created_at as last_run_at, last.status as last_run_status
  from automation_rules r
  left join users u on u.id = r.owner_id
  left join lateral (
    select created_at, status from automation_runs where rule_id = r.id order by id desc limit 1
  ) last on true`;

export const RUN_SELECT = `
  select x.*, r.name as rule_name, i.key as issue_key
  from automation_runs x
  join automation_rules r on r.id = x.rule_id
  left join issues i on i.id = x.issue_id`;

export function toRule(row: RuleRow): AutomationRule {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    enabled: row.enabled,
    isDraft: row.is_draft,
    trigger: { name: row.trigger.name, args: row.trigger.args ?? {} },
    conditions: row.conditions,
    actions: row.actions.map((action) => ({ name: action.name, args: action.args ?? {} })),
    createdBy: row.created_by,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    aiRunId: row.ai_run_id,
    lastRunAt: iso(row.last_run_at),
    lastRunStatus: row.last_run_status,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

export function toRun(row: RunRow): AutomationRun {
  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    status: row.status,
    trigger: row.trigger,
    issueId: row.issue_id,
    issueKey: row.issue_key,
    depth: row.depth,
    input: row.input,
    result: row.result ?? null,
    error: row.error,
    durationMs: row.duration_ms,
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    createdAt: iso(row.created_at)!,
  };
}

export async function ruleById(sql: SqlExecutor, id: string): Promise<RuleRow> {
  const [row] = await sql<RuleRow[]>`${sql.unsafe(RULE_SELECT)} where r.id = ${id}`;
  if (!row) throw new NotFoundError('The automation rule was not found');
  return row;
}

export async function runById(sql: SqlExecutor, id: string): Promise<RunRow> {
  const [row] = await sql<RunRow[]>`${sql.unsafe(RUN_SELECT)} where x.id = ${id}`;
  if (!row) throw new NotFoundError('The automation run was not found');
  return row;
}

export interface NewRun {
  ruleId: string;
  status: 'queued' | 'skipped';
  trigger: string;
  issueId: string | null;
  depth: number;
  input: Record<string, unknown>;
  error?: string;
}

export async function insertRun(sql: SqlExecutor, run: NewRun): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into automation_runs (rule_id, status, trigger, issue_id, depth, input, error,
      finished_at)
    values (${run.ruleId}, ${run.status}, ${run.trigger}, ${run.issueId}, ${run.depth},
      ${JSON.stringify(run.input)}::jsonb, ${run.error ?? null},
      ${run.status === 'skipped' ? new Date().toISOString() : null})
    returning id`;
  return row!.id;
}
