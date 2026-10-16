import type { SqlClient } from '@bemmoly/core';
import { hashToken, newToken } from '../utils/tokens.ts';

/*
 * What the execution tests need on top of the catalog fixture: a runner pool with a known
 * token, and a pipeline on an application (build, two sharded units, a matrix, a report).
 */

export const TEST_PIPELINE = {
  checkout: false,
  inputs: { suite: { type: 'choice', options: ['smoke', 'full'], default: 'smoke' } },
  build: {},
  test: [
    {
      name: 'Unit',
      image: 'node:24',
      run: 'pnpm test --suite ${{ inputs.suite }}',
      shards: 2,
      junit: 'reports/*.xml',
    },
    {
      name: 'Lint',
      image: 'node:${{ matrix.node }}',
      run: 'pnpm lint',
      matrix: { axes: { node: [22, 24] } },
    },
    { name: 'Report', run: 'echo done', needs: ['unit', 'lint'] },
  ],
};

export async function createPool(
  sql: SqlClient,
  key: string,
): Promise<{ id: string; token: string }> {
  const token = newToken('pool');
  const [pool] = await sql<{ id: string }[]>`
    insert into pipeline_runner_pools (key, name, hosting, max_runners, token_hash)
    values (${key}, ${key}, 'local', 20, ${hashToken(token)}) returning id`;
  if (!pool) throw new Error('pool insert returned nothing');
  return { id: pool.id, token };
}

export async function givePipeline(
  sql: SqlClient,
  application: string,
  pipeline: unknown = TEST_PIPELINE,
) {
  await sql`
    update pipeline_applications set pipeline = ${JSON.stringify(pipeline)}::jsonb,
      pipeline_source = 'repository'
    where key = ${application}`;
}
