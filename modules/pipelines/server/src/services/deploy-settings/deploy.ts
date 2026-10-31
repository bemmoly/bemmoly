import type { SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type {
  CloudProvider,
  DeployTarget,
  ReleaseArtifact,
  TargetsPart,
} from '../providers/contract.ts';
import { recordAddress } from './addresses.ts';
import { fileLayersOf, resolveDeploySettings } from './resolve.ts';
import { readDeploySettings } from './store.ts';

/*
 * Every deploy, from a rollout, a roll back that redeploys or a runtime move, goes through
 * here: the settings are resolved for the target's environment and runtime and handed to the
 * provider with the release, and the address the provider answers with is recorded for other
 * applications' references. Settings that contradict themselves stop the deploy first.
 */

/** The settings a deploy of `release` to `target` runs with, and why it may not. */
export async function resolutionFor(
  sql: SqlExecutor,
  target: DeployTarget,
  release: ReleaseArtifact,
) {
  const pipelines = await readDeploySettings(sql, target.application.id, target.environment.id);
  const { file, fileEnvironment, extras } = fileLayersOf(
    release.resolvedConfig,
    target.environment.key,
  );
  return resolveDeploySettings({
    layers: { pipelines, file, fileEnvironment },
    runtime: target.placement?.runtime ?? 'cloud-run',
    environmentClass: target.environment.class,
    environmentKey: target.environment.key,
    extras,
  });
}

export function withDeploySettings(
  sql: SqlExecutor,
  resolved: { provider: CloudProvider; target: DeployTarget },
): { provider: CloudProvider; target: DeployTarget } {
  const inner = resolved.provider.targets;
  if (!inner) return resolved;
  const targets: TargetsPart = {
    ...inner,
    async deploy(target, release, variables) {
      const resolution = await resolutionFor(sql, target, release);
      if (resolution.problem) throw new ValidationError(resolution.problem);
      const result = await inner.deploy(
        target,
        { ...release, settings: resolution.settings },
        variables,
      );
      if (result.address) {
        await recordAddress(sql, {
          applicationId: target.application.id,
          environmentId: target.environment.id,
          runtime: target.placement?.runtime ?? 'cloud-run',
          address: result.address,
        });
      }
      return result;
    },
  };
  return { provider: { ...resolved.provider, targets }, target: resolved.target };
}
