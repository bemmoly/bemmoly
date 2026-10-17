import type { RequestContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { storable } from './templates.ts';

/*
 * Postgres jsonb sorts an object's keys, so the run form's fields would come back
 * alphabetised by length. Declared order has to survive the trip through the database.
 */

const FILE = `name: lake-batch
group: lake
pipeline:
  extends: acme/batch@1
  inputs:
    window: { default: "1h" }
    dryRun: { type: boolean, default: false }
    at: { type: number, default: 3 }
`;

describe('the run form inputs', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';
  let system: RequestContext;

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    system = {
      ...harness.as(harness.users.admin),
      actor: { kind: 'system', id: 'code-host:test' },
    };
    const template = {
      inputs: {
        suite: { type: 'choice', options: ['smoke', 'full'], default: 'smoke' },
        flaky: { type: 'boolean', default: true },
      },
      test: [{ name: 'Unit', run: 'pytest -m ${{ inputs.suite }}' }],
    };
    await harness.sql`
      insert into pipeline_templates (ref, version, commit_sha, spec, latest)
      values ('acme/batch', 1, ${'a'.repeat(40)}, ${JSON.stringify(storable(template))}::jsonb, true)`;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('come back in the order application.yaml and the template declare them', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const result = await harness.services.catalogWrites.applyApplicationFiles(system, {
      repository: { fullName: 'acme/data', defaultBranch: 'main' },
      commitSha: 'b'.repeat(40),
      files: [{ path: 'batch/.bemmoly/application.yaml', content: FILE }],
    });
    expect(result.applied).toEqual(['lake-batch']);
    const member = harness.as(harness.users.member);
    const pipeline = await harness.services.runs.pipeline(member, 'lake-batch');
    expect(pipeline.inputs.map((input) => input.name)).toEqual([
      'suite',
      'flaky',
      'window',
      'dryRun',
      'at',
    ]);
    expect(Object.keys((pipeline.definition as { inputs: object }).inputs)).toEqual([
      'window',
      'dryRun',
      'at',
    ]);
  });
});
