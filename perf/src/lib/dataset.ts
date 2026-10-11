import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { LOAD_PREFIX } from './credentials.ts';

/*
 * The sample dataset of tech design §20 (3 projects, 5,000 issues, 400 pages), laid out so
 * one project is the 500-issue board the board-view budget names. The manifest seed.ts
 * writes is what the k6 scripts read: ids and keys only, no secrets.
 */

export interface ProjectPlan {
  key: string;
  name: string;
  method: 'kanban' | 'scrum';
  issues: number;
}

export interface SpacePlan {
  key: string;
  name: string;
  pages: number;
  /** Top-level pages; the rest are spread under them as children. */
  roots: number;
}

export interface SeedPlan {
  projects: ProjectPlan[];
  spaces: SpacePlan[];
}

export function samplePlan(options: { issues: number; boardIssues: number; pages: number }) {
  const rest = options.issues - options.boardIssues;
  if (rest < 2) throw new Error('--issues must leave at least two issues past the board');
  const platform = Math.round(rest * 0.45);
  const half = Math.ceil(options.pages / 2);
  const plan: SeedPlan = {
    projects: [
      {
        key: `${LOAD_PREFIX}A`,
        name: `${LOAD_PREFIX} Board`,
        method: 'kanban',
        issues: options.boardIssues,
      },
      {
        key: `${LOAD_PREFIX}B`,
        name: `${LOAD_PREFIX} Platform`,
        method: 'scrum',
        issues: platform,
      },
      {
        key: `${LOAD_PREFIX}C`,
        name: `${LOAD_PREFIX} Mobile`,
        method: 'scrum',
        issues: rest - platform,
      },
    ],
    spaces: [
      {
        key: `${LOAD_PREFIX}D`,
        name: `${LOAD_PREFIX} Handbook`,
        pages: half,
        roots: Math.max(1, Math.ceil(half / 10)),
      },
      {
        key: `${LOAD_PREFIX}E`,
        name: `${LOAD_PREFIX} Engineering`,
        pages: options.pages - half,
        roots: Math.max(1, Math.ceil((options.pages - half) / 10)),
      },
    ],
  };
  return plan;
}

/** Index of the root page a child page hangs under: children are dealt out round robin. */
export const parentIndexOf = (page: number, roots: number) => (page - roots) % roots;

const projectSchema = z.object({
  key: z.string(),
  id: z.uuid(),
  method: z.enum(['kanban', 'scrum']),
  boardId: z.uuid(),
  typeId: z.uuid(),
  issueKeys: z.array(z.string()),
});

const spaceSchema = z.object({
  key: z.string(),
  id: z.uuid(),
  pageIds: z.array(z.uuid()),
});

export const datasetSchema = z.object({
  createdAt: z.string(),
  baseUrl: z.string(),
  adminId: z.uuid(),
  /** Ids of the member people, in the order of the credentials file. */
  userIds: z.array(z.uuid()),
  projects: z.array(projectSchema),
  spaces: z.array(spaceSchema),
  /** The project whose board holds exactly the board-view budget's issue count. */
  boardProjectKey: z.string(),
  searchTerms: z.array(z.string()),
});

export type Dataset = z.infer<typeof datasetSchema>;
export type SeededProject = z.infer<typeof projectSchema>;
export type SeededSpace = z.infer<typeof spaceSchema>;

export const readDataset = (path: string): Dataset =>
  datasetSchema.parse(JSON.parse(readFileSync(path, 'utf8')));

export function writeDataset(path: string, dataset: Dataset): void {
  writeFileSync(path, `${JSON.stringify(dataset)}\n`);
}
