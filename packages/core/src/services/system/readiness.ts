import type { CheckResult, ReadinessResponse } from '@bemmoly/shared';

export interface DatabaseProbe {
  ping(timeoutMs: number): Promise<void>;
}

export interface ReadinessDependencies {
  /** Absent when DATABASE_URL is not set. */
  database?: DatabaseProbe;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2_000;

async function checkDatabase(deps: ReadinessDependencies): Promise<CheckResult> {
  if (!deps.database) {
    return { status: 'skipped', message: 'DATABASE_URL is not set' };
  }
  const started = performance.now();
  try {
    await deps.database.ping(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    return { status: 'ok', latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { status: 'failed', message: 'Database is not reachable' };
  }
}

export async function checkReadiness(deps: ReadinessDependencies): Promise<ReadinessResponse> {
  const database = await checkDatabase(deps);
  const status =
    database.status === 'failed'
      ? 'unavailable'
      : database.status === 'skipped'
        ? 'degraded'
        : 'ready';
  return { status, checks: { database } };
}
