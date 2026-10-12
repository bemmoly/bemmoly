import type { SqlClient } from '@bemmoly/core';
import { z } from 'zod';

/*
 * Deleting a project removes its issues by cascade, and the delete triggers on issues and
 * comments remove what points at them without a foreign key (comments, attachments,
 * watchers, links, notifications, embeddings). Up to INLINE_ISSUE_LIMIT issues that is one
 * transaction. Past it the project is marked purging, which hides it from every reader, and
 * the purge job deletes its issues ISSUE_BATCH at a time, each batch its own transaction,
 * then the project. A rerun after a crash continues where the last one stopped.
 */
export const INLINE_ISSUE_LIMIT = 5000;
export const ISSUE_BATCH = 500;

export const projectPurgePayloadSchema = z.object({ projectId: z.uuid() });

export type ProjectPurgePayload = z.infer<typeof projectPurgePayloadSchema>;

export const purgeIdempotencyKey = (projectId: string) => `project-purge:${projectId}`;

export async function countIssues(sql: SqlClient, projectId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from issues where project_id = ${projectId}`;
  return row?.n ?? 0;
}

/**
 * Finishes the delete of a project marked purging. A project that is gone already, or was
 * never marked, is left as it is, so a stray or repeated job deletes nothing it should not.
 * Returns the number of issues deleted.
 */
export async function purgeProject(
  sql: SqlClient,
  projectId: string,
  batch: number = ISSUE_BATCH,
): Promise<number> {
  const [project] = await sql<{ purging_at: Date | null }[]>`
    select purging_at from projects where id = ${projectId}`;
  if (!project?.purging_at) return 0;
  let total = 0;
  for (;;) {
    const rows = await sql<{ id: string }[]>`
      delete from issues where id in (
        select id from issues where project_id = ${projectId} order by id limit ${batch})
      returning id`;
    total += rows.length;
    if (rows.length < batch) break;
  }
  await sql`delete from projects where id = ${projectId} and purging_at is not null`;
  return total;
}
