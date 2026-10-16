import type { Health } from '../../../../../shared/common.ts';
import type { CloudProvider, DeployTarget, MetricsPart, TargetsPart } from '../contract.ts';
import {
  createLocalRuntime,
  localConfig,
  revisionContainer,
  upstreamOf,
  type LocalRuntime,
} from './runtime.ts';

/*
 * The local provider: container-service applications on this machine's Docker (Docker
 * Desktop or Colima), so a laptop sees real deploys, real canaries and real roll backs.
 * Each revision is a container; a splitter in front sends each request to a revision by
 * weight and counts what happened, and its counters are the metrics canaries are judged on.
 * Metrics, weights and revisions all live in Docker, never in this process.
 */

const KEEP_REVISIONS = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createLocalProvider(): CloudProvider {
  const runtimes = new Map<string, LocalRuntime>();
  const runtime = (target: DeployTarget | { connection: DeployTarget['connection'] }) => {
    const config = localConfig(target.connection.config);
    let found = runtimes.get(config.dockerHost);
    if (!found) {
      found = createLocalRuntime(config);
      runtimes.set(config.dockerHost, found);
    }
    return found;
  };

  const targets: TargetsPart = {
    kinds: ['container-service'],

    async deploy(target, release) {
      const local = runtime(target);
      const { client } = await local.splitter(target);
      const revision = await local.startRevision(target, release);
      const upstream = upstreamOf(target, revision);
      for (let attempt = 0; ; attempt += 1) {
        if (await client.probe(upstream)) break;
        if (attempt >= 60) throw new Error(`${revision} did not become healthy in 30 seconds`);
        await sleep(500);
      }
      // Keep the revisions taking traffic and the last few for instant roll backs.
      const routes = new Set(
        (await client.routes()).filter((r) => r.percent > 0).map((r) => r.revision),
      );
      const old = (await local.revisions(target)).filter(
        (r) => r.revision !== revision && !routes.has(r.revision),
      );
      for (const stale of old.slice(KEEP_REVISIONS - 1)) await local.docker.remove(stale.name);
      return { revision };
    },

    async shift(target, { revision, percent, stable }) {
      const { client } = await runtime(target).splitter(target);
      const routes = [{ revision, upstream: upstreamOf(target, revision), percent }];
      if (stable && percent < 100) {
        routes.push({
          revision: stable,
          upstream: upstreamOf(target, stable),
          percent: 100 - percent,
        });
      }
      await client.setRoutes(routes);
    },

    async rollback(target, previousRevision) {
      const local = runtime(target);
      // A stopped container (the machine restarted) is started again before it takes traffic.
      if (!(await local.running(revisionContainer(target, previousRevision)))) {
        throw new Error(`${previousRevision} is gone from Docker; deploy its release again`);
      }
      const { client } = await local.splitter(target);
      await client.setRoutes([
        {
          revision: previousRevision,
          upstream: upstreamOf(target, previousRevision),
          percent: 100,
        },
      ]);
    },

    async health(target, revision): Promise<Health> {
      const local = runtime(target);
      const container = await local.docker.inspect(revisionContainer(target, revision));
      if (!container?.State.Running) return 'failing';
      const { client } = await local.splitter(target);
      const to = new Date();
      const counts = await client.metrics({ revision, from: new Date(to.getTime() - 60_000), to });
      if (counts.errorRate === null) return 'unknown';
      if (counts.errorRate >= 0.05) return 'failing';
      return counts.errorRate >= 0.01 ? 'degraded' : 'healthy';
    },

    async describe(target) {
      const { client, url } = await runtime(target).splitter(target);
      const traffic = (await client.routes())
        .map((route) => ({ revision: route.revision, percent: route.percent }))
        .sort((a, b) => b.percent - a.percent);
      return { traffic, url };
    },

    async retire(target, revision) {
      const local = runtime(target);
      const { client } = await local.splitter(target);
      const routes = await client.routes();
      if (routes.some((route) => route.revision === revision && route.percent > 0)) {
        throw new Error(`${revision} still takes traffic`);
      }
      await client.setRoutes(routes.filter((route) => route.revision !== revision));
      await local.docker.remove(revisionContainer(target, revision));
    },
  };

  const metrics: MetricsPart = {
    async revision(target, revision, metric, window) {
      const { client } = await runtime(target).splitter(target);
      const counts = await client.metrics({ revision, from: window.from, to: window.to });
      const value = metric === 'error_rate' ? counts.errorRate : counts.p95;
      return {
        value: counts.requests > 0 ? value : null,
        requests: counts.requests,
        points: counts.series.flatMap(([at, errorRate, p95]) => {
          const point = metric === 'error_rate' ? errorRate : p95;
          return point === null ? [] : [[new Date(at), point] as [Date, number]];
        }),
      };
    },
    /** A 99.9% objective over what the splitter remembers (its last 30 minutes). */
    async errorBudget(target) {
      const { client } = await runtime(target).splitter(target);
      const to = new Date();
      const counts = await client.metrics({ from: new Date(to.getTime() - 30 * 60_000), to });
      if (counts.requests === 0) return null;
      const allowed = counts.requests * 0.001;
      return Math.max(0, Math.min(1, 1 - counts.errors / Math.max(allowed, 1)));
    },
  };

  return {
    id: 'local',
    name: 'This machine',
    description:
      'Docker on this computer: real containers, canaries and roll backs, for trying Pipelines',
    comingSoon: [],
    targets,
    metrics,
    connection: {
      async verify(connection) {
        const local = runtime({ connection });
        try {
          const ok = await local.docker.ping();
          return ok
            ? {
                ok: true,
                principal: `docker at ${localConfig(connection.config).dockerHost}`,
                problems: [],
              }
            : {
                ok: false,
                principal: null,
                problems: ['Docker answered, but not as expected. Restart Docker and try again.'],
              };
        } catch (error) {
          return {
            ok: false,
            principal: null,
            problems: [
              `${(error as Error).message}. Start Docker (or Colima) and check the socket path.`,
            ],
          };
        }
      },
    },
  };
}
