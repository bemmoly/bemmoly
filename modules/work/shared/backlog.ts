import { z } from 'zod';
import { issueSchema, rankIssueBodySchema } from './issues.ts';
import { sprintSchema } from './sprints.ts';

/*
 * Everything the Backlog screen paints in one call: the sprint containers
 * with their issues in rank order, the unsprinted issues in rank order and
 * the epic panel with progress. Capacity against committed points comes
 * with each sprint so the capacity bar needs no second request.
 */

export const backlogSprintSchema = z.object({
  sprint: sprintSchema,
  issues: z.array(issueSchema),
  committedPoints: z.number().nonnegative(),
  committedIssues: z.number().int().nonnegative(),
});

export const epicProgressSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  title: z.string(),
  statusId: z.uuid(),
  color: z.string().nullable(),
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  donePoints: z.number().nonnegative(),
  totalPoints: z.number().nonnegative(),
});

export const backlogSchema = z.object({
  projectId: z.uuid(),
  sprints: z.array(backlogSprintSchema),
  issues: z.array(issueSchema),
  epics: z.array(epicProgressSchema),
});

/**
 * `POST /work/issues/:key/move`: the drop target. `beforeIssueId` is the row
 * that ends up above the issue and `afterIssueId` the row below it, either of
 * which may be absent at the ends of a list; `sprintId` moves it between
 * containers (null is the backlog) and is left out to rank within the current
 * one.
 */
export const moveIssueBodySchema = rankIssueBodySchema;

export type BacklogSprint = z.infer<typeof backlogSprintSchema>;
export type EpicProgress = z.infer<typeof epicProgressSchema>;
export type Backlog = z.infer<typeof backlogSchema>;
export type MoveIssueBody = z.input<typeof moveIssueBodySchema>;
