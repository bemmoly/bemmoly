import {
  ConflictError,
  ProviderError,
  ValidationError,
  type RollbackRequest,
  type UpdaterAccepted,
  type UpdatesOverview,
} from '@bemmoly/shared';
import semver from 'semver';
import type { Actor } from '../../../contracts/authz.ts';
import { SYSTEM_CAPABILITY } from '../authorize.ts';
import type { SystemDependencies } from '../deps.ts';
import { readSetting } from '../settings.ts';
import { computeRollbackPlan } from './rollback-plan.ts';
import { toAvailableUpdate } from './select.ts';
import { readUpdateCheckState, readUpdaterState } from './state.ts';

async function requireSystem(deps: SystemDependencies, actor: Actor): Promise<void> {
  await deps.authorize(actor, SYSTEM_CAPABILITY, { kind: 'workspace' });
}

async function updaterView(deps: SystemDependencies): Promise<UpdatesOverview['updater']> {
  const mode = deps.updater ? 'in_app' : 'cli';
  const command = 'sudo bemmoly upgrade';
  if (!deps.updater) return { mode, command, state: 'idle', step: null };
  try {
    const status = await deps.updater.status();
    return { mode, command, state: status.state, step: status.step };
  } catch {
    return { mode, command, state: 'unreachable', step: null };
  }
}

/** Settings › Updates: version, channel, what is available and what a rollback would do. */
export async function getUpdatesOverview(
  deps: SystemDependencies,
  actor: Actor,
): Promise<UpdatesOverview> {
  await requireSystem(deps, actor);
  const [channel, enabled, check, updater, view, rollback] = await Promise.all([
    readSetting(deps.settings, 'system.updates.channel'),
    readSetting(deps.settings, 'system.updates.check'),
    readUpdateCheckState(deps.config.dataDir),
    readUpdaterState(deps.config.dataDir),
    updaterView(deps),
    computeRollbackPlan(deps, { preferRestore: false }),
  ]);
  const current = deps.config.appVersion;
  const available =
    check?.available && semver.valid(current) && semver.gt(check.available.version, current)
      ? toAvailableUpdate(check.available)
      : null;
  return {
    current: {
      version: current,
      channel,
      updatedAt: updater?.current === current ? updater.updatedAt : null,
      previousVersion: updater?.current === current ? updater.previous : null,
    },
    checks: {
      enabled,
      lastCheckedAt: check?.checkedAt ?? null,
      manifest: check?.manifest ?? null,
      error: check?.error ?? null,
    },
    available,
    rollback,
    updater: {
      ...view,
      command: available ? `${view.command} ${available.version}` : view.command,
    },
  };
}

function cliOnly(command: string): ConflictError {
  return new ConflictError(
    `In-app updates are off on this install. On the server, run: ${command}`,
    {
      details: { command },
    },
  );
}

/** Hands the update to the updater; the browser then follows the updater's progress page. */
export async function applyUpdate(
  deps: SystemDependencies,
  actor: Actor,
  version: string,
): Promise<UpdaterAccepted> {
  await requireSystem(deps, actor);
  if (!semver.valid(version) || !semver.gt(version, deps.config.appVersion)) {
    throw new ValidationError(`${version} is not newer than ${deps.config.appVersion}`);
  }
  const check = await readUpdateCheckState(deps.config.dataDir);
  if (check?.available && check.available.version !== version) {
    throw new ConflictError(`The available update is ${check.available.version}, not ${version}`);
  }
  if (!deps.updater) throw cliOnly(`sudo bemmoly upgrade ${version}`);
  try {
    await deps.updater.update(version);
  } catch (error) {
    throw new ProviderError('The updater did not accept the update', {
      provider: 'updater',
      cause: error,
    });
  }
  deps.logger.warn({ actor: actor.id, version }, 'update requested');
  return { accepted: true, operation: 'update', target: version };
}

/** Rolls back only if the mode is still the one the admin confirmed. */
export async function requestRollback(
  deps: SystemDependencies,
  actor: Actor,
  request: RollbackRequest,
): Promise<UpdaterAccepted> {
  await requireSystem(deps, actor);
  const plan = await computeRollbackPlan(deps, { preferRestore: request.preferRestore });
  if (!plan) throw new ConflictError('There is no update inside the rollback window to roll back');
  if (plan.mode !== request.expectedMode) {
    throw new ConflictError('The rollback plan changed since it was shown; review it again', {
      details: plan,
    });
  }
  if (!deps.updater) throw cliOnly('sudo bemmoly rollback');
  try {
    await deps.updater.rollback({ expectedMode: plan.mode, preferRestore: request.preferRestore });
  } catch (error) {
    throw new ProviderError('The updater did not accept the rollback', {
      provider: 'updater',
      cause: error,
    });
  }
  deps.logger.warn({ actor: actor.id, plan }, 'rollback requested');
  return { accepted: true, operation: 'rollback', target: plan.toVersion };
}
