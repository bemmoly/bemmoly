import { insertMany, type Row } from './bulk.ts';
import { planJobs, planSteps, type RunShape } from './jobs.ts';
import { COMMIT_OBJECTS, COMMIT_VERBS } from './names.ts';
import { DAY, HOUR, MINUTE, uuidv7, type Rng } from './rng.ts';
import { nextVersion, type AppInfo, type World } from './world.ts';

/*
 * Thirty days of runs, jobs and releases ending a few minutes before now. Weekdays carry
 * about 1,300 runs and weekends about 300, mostly during Acme's working hours in India
 * (03:00 to 14:00 UTC). Every passing run on main publishes one release per application it
 * built; deployments are drawn from those releases afterwards.
 */

export interface ReleaseInfo {
  id: string;
  app: AppInfo;
  version: string;
  createdAt: number;
  commitAt: number;
  authorId: string | null;
  runId: string;
}

/** Relative weight of each UTC hour: Acme works India hours, with some spill either side. */
const HOURS = [1, 1, 2, 6, 9, 10, 10, 9, 7, 9, 10, 9, 7, 5, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1];
const HOUR_TOTAL = HOURS.reduce((a, b) => a + b, 0);

function timeInDay(rng: Rng, dayStart: number): number {
  let roll = rng.next() * HOUR_TOTAL;
  let hour = 0;
  for (; hour < 23; hour += 1) {
    roll -= HOURS[hour] ?? 0;
    if (roll < 0) break;
  }
  return dayStart + hour * HOUR + rng.int(0, 59) * MINUTE + rng.int(0, 59) * 1000;
}

function picker(apps: readonly AppInfo[], rng: Rng) {
  const live = apps.filter((a) => a.weight > 0);
  const cumulative: number[] = [];
  let total = 0;
  for (const a of live) cumulative.push((total += a.weight));
  return () => {
    const roll = rng.next() * total;
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((cumulative[mid] ?? 0) < roll) low = mid + 1;
      else high = mid;
    }
    return live[low] as AppInfo;
  };
}

export const commitTitle = (rng: Rng) => `${rng.pick(COMMIT_VERBS)} ${rng.pick(COMMIT_OBJECTS)}`;

/** Authors come from the owning team; the demo person's own work is drawn separately. */
function authorOf(world: World, app: AppInfo): string | null {
  const members = (app.ownerTeam?.members ?? []).filter((id) => id !== world.demo.id);
  if (members.length > 0) return world.rng.pick(members);
  return world.people.length > 0 ? world.rng.pick(world.people).id : null;
}

export async function seedHistory(world: World): Promise<ReleaseInfo[]> {
  const { rng, now, scale, sql } = world;
  const pick = picker(world.apps, rng);
  const byRepo = new Map<string, AppInfo[]>();
  for (const a of world.apps) byRepo.set(a.repoId, [...(byRepo.get(a.repoId) ?? []), a]);
  const pools = world.pools.map((p) => p.id);
  const end = now.getTime() - 3 * MINUTE;
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const shapes: (RunShape & { app: AppInfo; trigger: string; pr: number | null })[] = [];
  for (let back = 29; back >= 0; back -= 1) {
    const dayStart = today.getTime() - back * DAY;
    const weekday = new Date(dayStart).getUTCDay() % 6 !== 0;
    const count = Math.round((weekday ? 1300 : 300) * scale);
    for (let i = 0; i < count; i += 1) {
      const createdAt = timeInDay(rng, dayStart);
      if (createdAt > end - 15 * MINUTE) continue;
      const app = pick();
      const external = app.ciMode === 'external';
      const trigger = external
        ? 'external'
        : rng.weighted([
            ['push', 36],
            ['pull_request', 48],
            ['merge_group', 10],
            ['manual', 6],
          ] as const);
      const main = external ? rng.chance(0.45) : trigger !== 'pull_request';
      const siblings = (byRepo.get(app.repoId) ?? []).filter((a) => a !== app && a.weight > 0);
      const apps = siblings.length > 0 && rng.chance(0.35) ? [app, rng.pick(siblings)] : [app];
      const roll = rng.next();
      shapes.push({
        id: uuidv7(rng, createdAt),
        app,
        apps,
        trigger,
        pr: main ? null : rng.int(900, 9900),
        monorepo: siblings.length > 0,
        main,
        state: roll < 0.06 ? 'failed' : roll < 0.08 && !main ? 'cancelled' : 'passed',
        priorityClass: main ? 'main' : 'pull_request',
        teamId: app.ownerTeam?.id ?? null,
        createdAt,
        startedAt: createdAt + rng.int(5, 90) * 1000,
      });
    }
  }
  shapes.sort((a, b) => a.createdAt - b.createdAt);

  const runs: Row[] = [];
  const links: Row[] = [];
  const releases: ReleaseInfo[] = [];
  const releaseRows: Row[] = [];
  let jobRows: Row[] = [];
  let stepRows: Row[] = [];
  let jobCount = 0;
  const flush = async (force: boolean) => {
    if (force || jobRows.length > 20_000) {
      await insertMany(sql, 'pipeline_runs', runs.splice(0));
      await insertMany(sql, 'pipeline_run_applications', links.splice(0));
      await insertMany(sql, 'pipeline_jobs', jobRows);
      await insertMany(sql, 'pipeline_steps', stepRows);
      jobCount += jobRows.length;
      jobRows = [];
      stepRows = [];
    }
  };
  for (const shape of shapes) {
    const plan = planJobs(shape, rng, pools);
    const author = authorOf(world, shape.app);
    const sha = rng.hex(40);
    runs.push({
      id: shape.id,
      repository_id: shape.app.repoId,
      trigger: shape.trigger,
      ref: shape.main ? 'main' : `pull/${shape.pr ?? 0}`,
      commit_sha: sha,
      title: commitTitle(rng),
      pull_request: shape.pr,
      issue_key: rng.chance(0.7) ? `ACME-${rng.int(100, 999)}` : null,
      author_user_id: author,
      team_id: shape.teamId,
      state: shape.state,
      priority_class: shape.priorityClass,
      executor: shape.trigger === 'external' ? 'external' : 'runners',
      external_url:
        shape.trigger === 'external'
          ? `https://github.com/${shape.app.repoFullName}/actions/runs/${rng.int(1e9, 9e9)}`
          : null,
      supersede_key: shape.pr ? `${shape.app.repoFullName}#${shape.pr}` : null,
      started_at: new Date(shape.startedAt),
      finished_at: new Date(plan.finishedAt),
      created_at: new Date(shape.createdAt),
      updated_at: new Date(plan.finishedAt),
    });
    for (const a of shape.apps)
      links.push({ run_id: shape.id, application_id: a.id, created_at: new Date(shape.createdAt) });
    jobRows.push(...plan.rows);
    if (shape.createdAt > end - 2 * DAY)
      for (const job of plan.jobs) stepRows.push(...planSteps(job, rng));
    if (shape.main && shape.state === 'passed') {
      for (const a of shape.apps) {
        const id = uuidv7(rng, plan.finishedAt);
        const version = nextVersion(a, rng);
        releases.push({
          id,
          app: a,
          version,
          createdAt: plan.finishedAt,
          commitAt: shape.createdAt,
          authorId: author,
          runId: shape.id,
        });
        releaseRows.push({
          id,
          application_id: a.id,
          version,
          source: a.ciMode === 'external' ? 'external' : 'runners',
          run_id: shape.id,
          commit_sha: sha,
          ref: 'main',
          image_repository: `asia-south1-docker.pkg.dev/acme-ci/${a.domainKey}/${a.key}`,
          image_digests: { 'linux/amd64': `sha256:${rng.hex(64)}` },
          resolved_config: {},
          test_summary: { passed: rng.int(40, 400), failed: 0, skipped: rng.int(0, 6) },
          created_by: author,
          created_at: new Date(plan.finishedAt),
          updated_at: new Date(plan.finishedAt),
        });
      }
    }
    await flush(false);
  }
  await flush(true);
  await insertMany(sql, 'pipeline_releases', releaseRows);
  world.log(`${shapes.length} runs, ${jobCount} jobs, ${releases.length} releases`);
  return releases;
}
