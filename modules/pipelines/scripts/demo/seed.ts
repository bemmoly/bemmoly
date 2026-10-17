import type { SqlClient } from '@bemmoly/core';
import type { LogObjects } from '../../server/src/services/logs/store.ts';
import { insertMany } from './bulk.ts';
import { seedCatalog } from './catalog.ts';
import { seedDeployments } from './deploys.ts';
import { seedForYou } from './foryou.ts';
import { seedCi } from './ci.ts';
import { seedGovernance } from './governance.ts';
import { seedHistory } from './history.ts';
import { seedJobLogs } from './job-logs.ts';
import { seedIdentityRollback, seedOtherChanges } from './incidents.ts';
import { seedLiveJobs, seedMoving, writeCurrent } from './live.ts';
import type { LiveState } from './make.ts';
import { seedPeople } from './people.ts';
import { seedPlatform } from './platform.ts';
import { createRng } from './rng.ts';
import { computeRollups, creditShippedWork } from './rollups.ts';
import type { World } from './world.ts';

export interface SeedOptions {
  /** The end of the history; defaults to the moment the seed runs. */
  now?: Date;
  /** 1 seeds the full Acme (1,140 applications, 30 days); tests pass a small fraction. */
  scale?: number;
  log?: (line: string) => void;
  /** Where job logs go; the server's object store. Without one they stay in this process. */
  objects?: LogObjects;
}

/** The same seed every time, so two runs draw the same company. */
const SEED = 2026;

/**
 * Seeds Acme into an empty Pipelines schema: people and teams in the kernel, the catalog,
 * clouds and environments, governance, 30 days of history and the live picture. Returns the
 * demo person, whose For you screen the seed fills.
 */
export async function seedDemo(sql: SqlClient, options: SeedOptions = {}) {
  const now = options.now ?? new Date();
  const scale = options.scale ?? 1;
  const log = options.log ?? (() => undefined);
  const ctx = { sql, rng: createRng(SEED), now, scale, log };
  // Acme is the organisation the product design draws; a workspace that already has a name
  // keeps it.
  await sql`
    insert into settings (key, value)
    select 'workspace.name', '"Acme"'::jsonb
    where not exists (select 1 from settings where key = 'workspace.name')`;
  const people = await seedPeople(ctx);
  const catalog = await seedCatalog(ctx, people.teams);
  const world: World = { ...ctx, ...people, ...catalog, envs: [], envByKey: new Map(), pools: [] };
  await seedPlatform(world);
  await seedGovernance(world);
  await seedCi(world);
  const releases = await seedHistory(world);
  const deployed = await seedDeployments(world, releases);
  await insertMany(sql, 'pipeline_changes', deployed.prodChanges);
  const live: LiveState = { current: deployed.current, moving: new Map() };
  await seedForYou(world, live);
  await seedIdentityRollback(world, live);
  await seedMoving(world, live);
  await seedLiveJobs(world);
  await writeCurrent(world, live);
  await seedOtherChanges(world);
  await computeRollups(world);
  await creditShippedWork(world);
  const logged = await seedJobLogs(sql, options.objects, Math.max(20, Math.round(300 * scale)));
  log(`logs and test results for ${logged.jobs} jobs (${logged.chunks} chunks)`);
  return { demo: people.demo };
}
