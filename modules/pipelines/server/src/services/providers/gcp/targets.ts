import { ConflictError, ValidationError } from '@bemmoly/shared';
import type { Health } from '../../../../../shared/common.ts';
import {
  LATEST_TARGET,
  REVISION_TARGET,
  runServiceName,
  serviceAccountEmail,
  type RunService,
} from '../../../clients/gcp/index.ts';
import type { RunTrafficTarget } from '../../../clients/gcp/cloud-run.ts';
import type { DeployTarget, ReleaseArtifact, TargetsPart } from '../contract.ts';
import { placeOf, type GcpContexts } from './context.ts';

/*
 * Cloud Run as the container-service target (architecture §12). A deploy adds a revision
 * pinned at 0% with a tag, so it has its own URL for smoke tests before any customer reaches
 * it; shift and rollback rewrite the split, keeping every tag so those URLs stay up. All of
 * it runs as the environment's deployer, so the project's audit log names that identity.
 */

const slug = (value: string, max: number) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');

/** "checkout-api-v1-43-0-a1c9e3f": Cloud Run requires the service name as the prefix. */
export function revisionIdOf(service: string, release: ReleaseArtifact): string {
  const suffix = `${slug(release.version, 20)}-${slug(release.commitSha, 7)}`;
  return `${service}-${suffix}`.slice(0, 63).replace(/-+$/, '');
}

const tagOf = (release: ReleaseArtifact) =>
  `r-${slug(release.version, 12)}-${slug(release.commitSha, 7)}`;

function imageOf(release: ReleaseArtifact): string {
  const digest = release.imageDigests['linux/amd64'] ?? Object.values(release.imageDigests)[0];
  if (!release.imageRepository || !digest) {
    throw new ValidationError(`Release ${release.version} has no image to deploy`);
  }
  return `${release.imageRepository}@${digest}`;
}

/** The split as explicit revisions: "latest" would move to every new revision on its own. */
function pinned(service: RunService): RunTrafficTarget[] {
  return service.traffic.map((entry) =>
    entry.type === LATEST_TARGET && service.latestReadyRevision
      ? { ...entry, type: REVISION_TARGET, revision: service.latestReadyRevision }
      : entry,
  );
}

/** Weights for the named revisions, every other tagged revision kept at 0%. */
function split(service: RunService, weights: ReadonlyArray<[string, number]>): RunTrafficTarget[] {
  const current = pinned(service);
  const tagFor = (revision: string) => current.find((entry) => entry.revision === revision)?.tag;
  const named = new Set(weights.map(([revision]) => revision));
  return [
    ...weights.map(([revision, percent]) => {
      const tag = tagFor(revision);
      return { type: REVISION_TARGET, revision, percent, ...(tag ? { tag } : {}) };
    }),
    ...current
      .filter((entry) => entry.tag && entry.revision && !named.has(entry.revision))
      .map((entry) => ({ ...entry, percent: 0 })),
  ];
}

export function createGcpTargets(contexts: GcpContexts): TargetsPart {
  const open = (target: DeployTarget) => {
    const context = contexts(target.connection);
    const place = placeOf(target, context.config);
    const run = context.deployer(place.projectId).run;
    const name = runServiceName(place.projectId, place.region, place.service);
    return { place, run, name };
  };

  async function service(
    target: DeployTarget,
  ): Promise<ReturnType<typeof open> & { current: RunService }> {
    const opened = open(target);
    const current = await opened.run.getService(opened.name);
    if (!current)
      throw new ValidationError(
        `${target.application.key} is not deployed to ${target.environment.key}`,
      );
    return { ...opened, current };
  }

  return {
    kinds: ['container-service'],

    async deploy(target, release) {
      const { place, run, name } = open(target);
      const revision = revisionIdOf(place.service, release);
      const image = imageOf(release);
      const existing = await run.getService(name);
      const tagged = { type: REVISION_TARGET, revision, tag: tagOf(release) };
      if (!existing) {
        // Cloud Run will not create a service whose split sends nothing anywhere, so the
        // first revision of a new service necessarily takes all of its (zero) traffic.
        await run.createService(
          `projects/${place.projectId}/locations/${place.region}`,
          place.service,
          {
            template: {
              revision,
              serviceAccount: serviceAccountEmail('runtime', place.projectId),
              containers: [{ image }],
            },
            traffic: [{ ...tagged, percent: 100 }],
          },
        );
        return { revision };
      }
      const containers = (existing.template['containers'] as
        Array<Record<string, unknown>> | undefined) ?? [{}];
      await run.updateService({
        name,
        etag: existing.etag,
        template: {
          ...existing.template,
          revision,
          containers: [{ ...containers[0], image }, ...containers.slice(1)],
        },
        traffic: [...pinned(existing), { ...tagged, percent: 0 }],
      });
      return { revision };
    },

    async shift(target, input) {
      const { run, name, current } = await service(target);
      const weights: Array<[string, number]> = [[input.revision, input.percent]];
      if (input.stable && input.percent < 100) weights.push([input.stable, 100 - input.percent]);
      await run.updateService({ ...current, name, traffic: split(current, weights) });
    },

    async rollback(target, previousRevision) {
      const { run, name, current } = await service(target);
      await run.updateService({
        ...current,
        name,
        traffic: split(current, [[previousRevision, 100]]),
      });
    },

    async health(target, revision): Promise<Health> {
      const { run, name } = open(target);
      const found = await run.getRevision(`${name}/revisions/${revision}`);
      if (!found) return 'unknown';
      const ready = found.conditions.find((condition) => condition.type === 'Ready');
      if (ready?.state === 'CONDITION_FAILED') return 'failing';
      if (ready?.state !== 'CONDITION_SUCCEEDED') return 'unknown';
      const troubled = found.conditions.some((condition) => condition.state === 'CONDITION_FAILED');
      return troubled ? 'degraded' : 'healthy';
    },

    async describe(target) {
      const { run, name } = open(target);
      const current = await run.getService(name);
      if (!current) return { traffic: [], url: null };
      const traffic = current.trafficStatuses
        .map((status) => ({
          revision:
            status.revision ??
            (status.type === LATEST_TARGET ? (current.latestReadyRevision ?? '') : ''),
          percent: status.percent ?? 0,
        }))
        .filter((weight) => weight.revision && weight.percent > 0)
        .sort((a, b) => b.percent - a.percent);
      return { traffic, url: current.uri ?? null };
    },

    async retire(target, revision) {
      const { run, name, current } = await service(target);
      const serving = current.trafficStatuses.find((status) => status.revision === revision);
      if ((serving?.percent ?? 0) > 0) {
        throw new ConflictError(`${revision} still takes ${serving?.percent}% of traffic`);
      }
      const traffic = pinned(current);
      if (traffic.some((entry) => entry.revision === revision)) {
        await run.updateService({
          ...current,
          name,
          traffic: traffic.filter((entry) => entry.revision !== revision),
        });
      }
      await run.deleteRevision(`${name}/revisions/${revision}`);
    },
  };
}
