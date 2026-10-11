import { pool, type Api } from '../clients/api.ts';
import { commentBody, issueDescription, issueTitle, PRIORITIES } from '../lib/content.ts';
import type { ProjectPlan, SeededProject } from '../lib/dataset.ts';

export interface SeedContext {
  admin: Api;
  /** One client per member person; requests are dealt out across them. */
  people: Api[];
  userIds: string[];
  concurrency: number;
  log: (line: string) => void;
}

interface Named {
  id: string;
  key: string;
}
interface Transition {
  toStatusId: string;
  toStatusName: string;
}

const MEMBER_BATCH = 100;
/** One issue in this many gets a comment, so the issue page has activity to load. */
const COMMENT_EVERY = 10;

export async function addInBatches(api: Api, path: string, userIds: readonly string[]) {
  for (let start = 0; start < userIds.length; start += MEMBER_BATCH) {
    await api.post(path, { userIds: userIds.slice(start, start + MEMBER_BATCH) });
  }
}

const personFor = (ctx: SeedContext, index: number) =>
  ctx.people[index % ctx.people.length] ?? ctx.admin;

async function transitions(api: Api, issueKey: string): Promise<Transition[]> {
  const { items } = await api.get<{ items: Transition[] }>(`/work/issues/${issueKey}/transitions`);
  return items;
}

/**
 * Spreads a kanban board over three columns, as a working board looks: a third of the
 * issues one step along the workflow, a third two steps, a third where they started.
 */
async function spreadStatuses(ctx: SeedContext, keys: readonly string[]) {
  const [first, second] = keys;
  if (!first || !second) return;
  const start = (await ctx.admin.get<{ statusId: string }>(`/work/issues/${first}`)).statusId;
  const stepOne = (await transitions(ctx.admin, first)).find((t) => t.toStatusId !== start);
  if (!stepOne) return;
  await ctx.admin.patch(`/work/issues/${second}`, { statusId: stepOne.toStatusId });
  const stepTwo = (await transitions(ctx.admin, second)).find(
    (t) => t.toStatusId !== start && t.toStatusId !== stepOne.toStatusId,
  );
  await pool(keys, ctx.concurrency, async (key, index) => {
    const api = personFor(ctx, index);
    if (index % 3 === 0 || key === second) return;
    await api.patch(`/work/issues/${key}`, { statusId: stepOne.toStatusId });
    if (index % 3 === 2 && stepTwo)
      await api.patch(`/work/issues/${key}`, { statusId: stepTwo.toStatusId });
  });
  ctx.log(`  statuses: ${stepOne.toStatusName}${stepTwo ? `, ${stepTwo.toStatusName}` : ''}`);
}

export async function seedProject(
  ctx: SeedContext,
  plan: ProjectPlan,
  offset: number,
): Promise<SeededProject> {
  const started = performance.now();
  const project = await ctx.admin.post<Named>('/work/projects', {
    key: plan.key,
    name: plan.name,
    method: plan.method,
    description: 'Load-test data, created and removed by the perf harness.',
  });
  await addInBatches(ctx.admin, `/work/projects/${plan.key}/members`, ctx.userIds);
  const types = await ctx.admin.get<{ items: Named[] }>(`/work/projects/${plan.key}/issue-types`);
  const typeId = (types.items.find((type) => type.key === 'task') ?? types.items[0])?.id;
  if (!typeId) throw new Error(`${plan.key} has no issue types`);
  const boards = await ctx.admin.get<{ items: Named[] }>(`/work/projects/${plan.key}/boards`);
  const boardId = boards.items[0]?.id;
  if (!boardId) throw new Error(`${plan.key} has no board`);

  const indexes = Array.from({ length: plan.issues }, (_, i) => i);
  const created = await pool(indexes, ctx.concurrency, async (i) => {
    const n = offset + i;
    const issue = await personFor(ctx, i).post<Named>('/work/issues', {
      projectId: project.id,
      typeId,
      title: issueTitle(n),
      description: issueDescription(n),
      priority: PRIORITIES[n % PRIORITIES.length],
      estimate: (n % 8) + 1,
      ...(n % 3 === 0 ? { assigneeId: ctx.userIds[n % ctx.userIds.length] } : {}),
    });
    if ((i + 1) % 500 === 0) ctx.log(`  ${plan.key}: ${i + 1}/${plan.issues} issues`);
    return issue.key;
  });
  if (plan.method === 'kanban') await spreadStatuses(ctx, created);
  const commented = created.filter((_, i) => i % COMMENT_EVERY === 0);
  await pool(commented, ctx.concurrency, (key, i) =>
    personFor(ctx, i + 1).post(`/work/issues/${key}/comments`, { body: commentBody(offset + i) }),
  );
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  ctx.log(`  ${plan.key}: ${created.length} issues, ${commented.length} comments in ${seconds} s`);
  return {
    key: plan.key,
    id: project.id,
    method: plan.method,
    boardId,
    typeId,
    issueKeys: created,
  };
}
