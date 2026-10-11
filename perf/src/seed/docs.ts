import { pool } from '../clients/api.ts';
import { pageBody, pageTitle } from '../lib/content.ts';
import { parentIndexOf, type SeededSpace, type SpacePlan } from '../lib/dataset.ts';
import { addInBatches, type SeedContext } from './work.ts';

interface Created {
  id: string;
}

/** A space of `plan.pages` pages: `plan.roots` at the top, the rest one level under them. */
export async function seedSpace(
  ctx: SeedContext,
  plan: SpacePlan,
  offset: number,
): Promise<SeededSpace> {
  const started = performance.now();
  const space = await ctx.admin.post<Created>('/docs/spaces', {
    key: plan.key,
    name: plan.name,
    description: 'Load-test pages, created and removed by the perf harness.',
  });
  await addInBatches(ctx.admin, `/docs/spaces/${plan.key}/members`, ctx.userIds);
  const create = (index: number, parentId?: string) => {
    const person = ctx.people[index % ctx.people.length] ?? ctx.admin;
    return person.post<Created>('/docs/pages', {
      spaceId: space.id,
      ...(parentId ? { parentId } : {}),
      title: pageTitle(plan.key, offset + index),
      snapshot: pageBody(offset + index),
    });
  };
  const rootIndexes = Array.from({ length: plan.roots }, (_, i) => i);
  const roots = await pool(rootIndexes, ctx.concurrency, (i) => create(i));
  const childIndexes = Array.from({ length: plan.pages - plan.roots }, (_, i) => plan.roots + i);
  const children = await pool(childIndexes, ctx.concurrency, (i) =>
    create(i, roots[parentIndexOf(i, plan.roots)]?.id),
  );
  const pageIds = [...roots, ...children].map((page) => page.id);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  ctx.log(`  ${plan.key}: ${pageIds.length} pages in ${seconds} s`);
  return { key: plan.key, id: space.id, pageIds };
}
