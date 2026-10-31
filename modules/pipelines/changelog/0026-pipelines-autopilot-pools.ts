import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Runner pools on GKE Autopilot. Pipelines starts one pod per job in the pool's namespace on
 * an Autopilot cluster, so a pool may now say it runs there. How it runs (the cluster, the
 * runner image, the size of each pod) lives in the pool's config like Cloud Build's.
 */
export default changeset({
  id: '0026-pipelines-autopilot-pools',
  author: 'bemmoly',
  description: 'Let a runner pool run on GKE Autopilot',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_runner_pools
        DROP CONSTRAINT IF EXISTS pipeline_runner_pools_hosting_check,
        ADD CONSTRAINT pipeline_runner_pools_hosting_check CHECK (hosting IN
          ('kubernetes', 'vm', 'local', 'cloud-build', 'codebuild', 'gke-autopilot'))`);
  },
  down: async (ctx) => {
    // The previous release cannot start pods; its nearest is a cluster whose runners people start.
    await ctx.exec(sql`
      UPDATE pipeline_runner_pools SET hosting = 'kubernetes' WHERE hosting = 'gke-autopilot'`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_runner_pools
        DROP CONSTRAINT pipeline_runner_pools_hosting_check,
        ADD CONSTRAINT pipeline_runner_pools_hosting_check CHECK (hosting IN
          ('kubernetes', 'vm', 'local', 'cloud-build', 'codebuild'))`);
  },
});
