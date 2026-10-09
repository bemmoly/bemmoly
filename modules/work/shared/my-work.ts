import { timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { issueKeySchema } from './common.ts';
import { issuePrioritySchema, statusCategorySchema } from './enums.ts';

/*
 * "My work" on Home: the issues assigned to the person, the ones they
 * reported and the ones they watch, each a short list with a total, read in
 * one request so Home renders its tabs at once.
 */

export const myIssuesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(6),
});

export const myIssueSchema = z.object({
  id: z.uuid(),
  key: issueKeySchema,
  title: z.string(),
  priority: issuePrioritySchema,
  dueAt: z.iso.date().nullable(),
  updatedAt: timestampSchema,
  status: z.object({
    id: z.uuid(),
    name: z.string(),
    category: statusCategorySchema,
    color: z.string().nullable(),
  }),
  type: z.object({
    id: z.uuid(),
    key: z.string(),
    name: z.string(),
    icon: z.string().nullable(),
    color: z.string().nullable(),
  }),
});

export const myIssueListSchema = z.object({
  items: z.array(myIssueSchema),
  /** Every match, not only the ones listed: the count beside the tab. */
  total: z.number().int().min(0),
});

export const myIssuesSchema = z.object({
  assigned: myIssueListSchema,
  reported: myIssueListSchema,
  /** Watched issues the person neither reported nor is assigned, so no tab repeats another. */
  watching: myIssueListSchema,
});

export type MyIssuesQuery = z.infer<typeof myIssuesQuerySchema>;
export type MyIssue = z.infer<typeof myIssueSchema>;
export type MyIssueList = z.infer<typeof myIssueListSchema>;
export type MyIssues = z.infer<typeof myIssuesSchema>;
