import { hasErrorCode, queryKeys } from '@bemmoly/api-client';
import type { HealthCheck, ReadinessResponse, SystemStatus } from '@bemmoly/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';

/** "pending" is a probe that only runs for a signed-in admin. */
export type HealthRowStatus = HealthCheck['status'] | 'pending';

export interface HealthRow {
  id: string;
  name: string;
  status: HealthRowStatus;
  detail: string;
  fix?: { label: string; href: string };
}

export const PENDING_DETAIL = 'Checked after the admin account is created';

/** The rows the Setup mock lists after Postgres, in its order. */
const LATER_CHECKS: ReadonlyArray<Pick<HealthRow, 'id' | 'name'>> = [
  { id: 'disk', name: 'Disk' },
  { id: 'memory', name: 'Memory' },
  { id: 'smtp', name: 'Outbound email (SMTP)' },
  { id: 'https', name: 'HTTPS' },
  { id: 'backups', name: 'Backups' },
];

/** The anonymous /readyz answer as the Postgres row. */
export function databaseRow(
  readiness: ReadinessResponse | undefined,
  failure?: unknown,
): HealthRow {
  const base = { id: 'postgres', name: 'Postgres 18' };
  if (failure) return { ...base, status: 'failed', detail: 'The server did not answer' };
  if (!readiness) return { ...base, status: 'pending', detail: 'Checking…' };
  const check = readiness.checks.database;
  if (check.status === 'ok') {
    const latency =
      check.latencyMs === undefined ? 'reachable' : `${Math.round(check.latencyMs)} ms`;
    return { ...base, status: 'ok', detail: latency };
  }
  if (check.status === 'skipped') {
    return { ...base, status: 'warning', detail: check.message ?? 'not configured' };
  }
  return { ...base, status: 'failed', detail: check.message ?? 'not reachable' };
}

/**
 * Health rows for step 1. The full list needs a signed-in admin; before that,
 * or when the server refuses it, Postgres comes from /readyz and the rest say
 * when they will be checked.
 */
export function healthRows(input: {
  readiness: ReadinessResponse | undefined;
  readinessError?: unknown;
  system: SystemStatus | undefined;
}): HealthRow[] {
  if (input.system?.health.length) return input.system.health;
  return [
    databaseRow(input.readiness, input.readinessError),
    ...LATER_CHECKS.map((check) => ({
      ...check,
      status: 'pending' as const,
      detail: PENDING_DETAIL,
    })),
  ];
}

/** The line under "Your server is up", in plain words from what was actually checked. */
export function healthHeadline(rows: readonly HealthRow[]): string {
  const database = rows.find((row) => row.id === 'postgres');
  if (database?.status === 'failed') return `Bemmoly cannot reach Postgres: ${database.detail}.`;
  if (database?.status === 'ok') return 'Bemmoly found a healthy Postgres.';
  return 'Bemmoly is checking the server.';
}

/** "host · v0.1.0 · self-hosted", without the version when the server has not said it. */
export function serverLabel(host: string, version: string | undefined): string {
  return [host, version ? `v${version}` : null, 'self-hosted'].filter(Boolean).join(' · ');
}

/** Step 1's health checks and the header's server line. */
export function useSetupHealth(signedIn: boolean) {
  const readiness = useQuery({
    queryKey: queryKeys.readiness(),
    queryFn: () => api.setup.readiness(),
    retry: false,
  });
  const system = useQuery({
    queryKey: queryKeys.system(),
    queryFn: () => api.system.status(),
    enabled: signedIn,
    retry: false,
  });
  const refused =
    hasErrorCode(system.error, 'forbidden') || hasErrorCode(system.error, 'not_found');
  const rows = healthRows({
    readiness: readiness.data,
    readinessError: readiness.error,
    system: refused ? undefined : system.data,
  });
  return {
    rows,
    headline: healthHeadline(rows),
    serverLabel: serverLabel(window.location.host, system.data?.version),
    loading: readiness.isPending,
    refetch: () => {
      void readiness.refetch();
      if (signedIn) void system.refetch();
    },
  };
}
