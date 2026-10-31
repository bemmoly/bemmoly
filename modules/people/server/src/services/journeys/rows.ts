import type { SqlExecutor } from '@bemmoly/core';
import {
  templateTaskSchema,
  type Journey,
  type JourneyKind,
  type JourneyTask,
  type JourneyTemplate,
} from '../../../../shared/journeys.ts';
import { dateOf, iso, isoOrNull } from '../common.ts';

export interface TemplateRow {
  id: string;
  name: string;
  kind: JourneyKind;
  location_id: string | null;
  job_title: string | null;
  tasks: unknown;
  archived_at: Date | null;
}

export interface JourneyRow {
  id: string;
  user_id: string;
  kind: JourneyKind;
  template_id: string | null;
  template_name: string;
  anchor_date: Date | string;
  state: Journey['state'];
  task_count: number;
  done_count: number;
  created_at: Date | string;
}

export interface TaskRow {
  id: string;
  journey_id: string;
  title: string;
  owner_id: string | null;
  due_date: Date | string;
  done_at: Date | null;
  done_by: string | null;
}

export const toTemplate = (row: TemplateRow): JourneyTemplate => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  locationId: row.location_id,
  jobTitle: row.job_title,
  tasks: templateTaskSchema.array().parse(row.tasks),
  archived: row.archived_at !== null,
});

export const toJourney = (row: JourneyRow): Journey => ({
  id: row.id,
  userId: row.user_id,
  kind: row.kind,
  templateId: row.template_id,
  templateName: row.template_name,
  anchorDate: dateOf(row.anchor_date),
  state: row.state,
  taskCount: Number(row.task_count),
  doneCount: Number(row.done_count),
  createdAt: iso(row.created_at),
});

export const toTask = (row: TaskRow): JourneyTask => ({
  id: row.id,
  journeyId: row.journey_id,
  title: row.title,
  ownerId: row.owner_id,
  dueDate: dateOf(row.due_date),
  doneAt: isoOrNull(row.done_at),
  doneBy: row.done_by,
});

/** Journeys with their task counts. */
export const JOURNEYS = (sql: SqlExecutor) => sql`
  select j.id, j.user_id, j.kind, j.template_id, j.template_name, j.anchor_date, j.state,
    j.created_at,
    (select count(*)::int from journey_tasks t where t.journey_id = j.id) as task_count,
    (select count(*)::int from journey_tasks t where t.journey_id = j.id and t.done_at is not null)
      as done_count
  from journeys j`;
