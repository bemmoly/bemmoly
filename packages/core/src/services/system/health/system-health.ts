import type { SystemCheck, SystemHealthResponse } from '@bemmoly/shared';
import type { Actor } from '../../../contracts/authz.ts';
import { SYSTEM_CAPABILITY } from '../authorize.ts';
import { createBackupRepository } from '../backups/repository.ts';
import { describeFrequency } from '../backups/schedule.ts';
import type { SystemDependencies } from '../deps.ts';
import { readMaintenance } from '../maintenance/state.ts';
import { readSetting } from '../settings.ts';
import {
  checkDisk,
  checkHttps,
  checkMemory,
  checkPostgres,
  checkSmtp,
  type HttpsSignal,
} from './checks.ts';

const SAFETY_NET_HOURS = 36;
const startedAt = Date.now();

export async function checkBackups(deps: SystemDependencies): Promise<SystemCheck> {
  const schedule = await readSetting(deps.settings, 'system.backups.schedule');
  const s3 = await readSetting(deps.settings, 'system.backups.s3');
  const where = s3?.enabled ? `${deps.config.backupDir} + S3` : deps.config.backupDir;
  const value = `${describeFrequency(schedule)} to ${where}`;
  const fixHref = '/settings/storage';
  try {
    const repository = createBackupRepository(deps.sql);
    const [lastGood, lastAny] = await Promise.all([
      repository.latest({ status: 'succeeded' }),
      repository.latest(),
    ]);
    if (lastAny?.status === 'failed') {
      return {
        id: 'backups',
        name: 'Backups',
        status: 'fail',
        value: `${value} · last run failed`,
        fix: { label: 'View', hint: lastAny.error ?? 'The last backup failed.', href: fixHref },
      };
    }
    const now = deps.now?.() ?? new Date();
    if (lastGood && now.getTime() - lastGood.createdAt.getTime() > SAFETY_NET_HOURS * 3_600_000) {
      return {
        id: 'backups',
        name: 'Backups',
        status: 'warn',
        value: `${value} · none in ${SAFETY_NET_HOURS} h`,
        fix: {
          label: 'Back up now',
          hint: 'No backup has completed for a day and a half.',
          href: fixHref,
        },
      };
    }
  } catch {
    return {
      id: 'backups',
      name: 'Backups',
      status: 'warn',
      value,
      fix: {
        label: 'Details',
        hint: 'The backups table is not there yet; changesets have not run.',
        href: fixHref,
      },
    };
  }
  return { id: 'backups', name: 'Backups', status: 'ok', value, fix: null };
}

/**
 * GET /api/v1/admin/system: the checks of the Setup mock's first step, which the
 * installer and `bemmoly doctor` also run. Each failing check carries its fix.
 */
export async function getSystemHealth(
  deps: SystemDependencies,
  actor: Actor | null,
  https: HttpsSignal,
): Promise<SystemHealthResponse> {
  if (actor) await deps.authorize(actor, SYSTEM_CAPABILITY, { kind: 'workspace' });
  const [postgres, disk, memory, smtp, backups, maintenance] = await Promise.all([
    checkPostgres(deps.sql, deps.config.databaseUrl),
    checkDisk(deps.config.dataDir),
    checkMemory(),
    deps.email ? deps.email.describe().catch(() => null) : Promise.resolve(null),
    checkBackups(deps),
    readMaintenance(deps.config.dataDir),
  ]);
  return {
    version: deps.config.appVersion,
    role: deps.config.role,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1_000),
    maintenance: { active: maintenance !== null, reason: maintenance?.reason ?? null },
    checks: [postgres, disk, memory, checkSmtp(smtp), checkHttps(https), backups],
  };
}
