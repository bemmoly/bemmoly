import type { SqlExecutor } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import { OPEN_MOVE_STATES } from '../../../../shared/moves.ts';
import type { CloudProvider, DeployTarget, TargetsPart } from '../providers/contract.ts';
import { RUNTIME_NAMES } from '../runtimes/fit.ts';
import { enabledDoor, routeOf, servingRuntime, writeRoute } from './routing.ts';

/*
 * Deploys behind a front door. The rollout engine runs as it always has; this wraps the
 * target it resolved so the front door follows. On a runtime the front door reaches revision
 * by revision (GKE), every shift and roll back is written to the front door too. On Cloud
 * Run the front door sends to the service, whose own split already moved. A deploy waits
 * while a move is under way, and a deploy to a runtime the front door does not serve from
 * is refused: that switch is a move, planned on the application's page.
 */

export async function withFrontDoor(
  sql: SqlExecutor,
  resolved: { provider: CloudProvider; target: DeployTarget },
): Promise<{ provider: CloudProvider; target: DeployTarget }> {
  const { provider, target } = resolved;
  const inner = provider.targets;
  const part = provider.frontDoor;
  if (!inner || !part) return resolved;
  const door = await enabledDoor(sql, target.environment.id);
  const route = door ? await routeOf(sql, door.id, target.application.id) : null;
  if (!door || !route) return resolved;
  const runtime = target.placement?.runtime ?? 'cloud-run';
  const byRevision = part.routesRevisions.includes(runtime);
  const app = target.application.key;
  const env = target.environment.key;

  async function refuse() {
    const [move] = await sql<{ to_runtime: string }[]>`
      select to_runtime from pipeline_runtime_moves
      where application_id = ${target.application.id} and environment_id = ${target.environment.id}
        and state = any(${OPEN_MOVE_STATES.filter((state) => state !== 'planned')}::text[])`;
    if (move) {
      const to = RUNTIME_NAMES[move.to_runtime as keyof typeof RUNTIME_NAMES];
      return `${app} is moving to ${to} in ${env}. Deploy again once the move finishes or is rolled back`;
    }
    const serving = servingRuntime(route?.backends ?? []);
    if (serving && serving !== runtime) {
      return `The front door in ${env} sends ${app}'s traffic to ${RUNTIME_NAMES[serving]}. Choose ${RUNTIME_NAMES[runtime]} on its page to move it there with a plan`;
    }
    return null;
  }

  const follow = async (weights: Array<[string, number]>) => {
    if (!byRevision || !door) return;
    await writeRoute(
      sql,
      provider,
      door,
      weights.map(([revision, percent]) => ({ target, revision, percent })),
    );
  };

  const targets: TargetsPart = {
    ...inner,
    async deploy(deployTarget, release, variables) {
      const reason = await refuse();
      if (reason) throw new ProviderError(reason);
      return inner.deploy(deployTarget, release, variables);
    },
    async shift(shiftTarget, input) {
      await inner.shift(shiftTarget, input);
      await follow(
        input.stable && input.percent < 100
          ? [
              [input.revision, input.percent],
              [input.stable, 100 - input.percent],
            ]
          : [[input.revision, 100]],
      );
    },
    async rollback(rollbackTarget, previousRevision) {
      await inner.rollback(rollbackTarget, previousRevision);
      await follow([[previousRevision, 100]]);
    },
  };
  return { provider: { ...provider, targets }, target };
}
