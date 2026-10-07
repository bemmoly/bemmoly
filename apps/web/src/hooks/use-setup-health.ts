import { queryKeys } from '@bemmoly/api-client';
import type { ReadinessResponse, SystemCheck, SystemHealthResponse } from '@bemmoly/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';

/** "pending" is a probe that has not answered (or could not be asked). */
export type HealthRowStatus = 'ok' | 'warning' | 'failed' | 'pending';

export interface HealthRow {
  id: string;
  name: string;
  status: HealthRowStatus;
  detail: string;
  /** A settings page that fixes it. */
  fix?: { label: string; href: string };
  /** A fix with no page to open, in words. */
  hint?: string;
}

export const PENDING_DETAIL = 'Not checked: the server did not answer';

/** The rows the Setup mock lists, in its order, for when the full check cannot run. */
const ROWS: ReadonlyArray<Pick<HealthRow, 'id' | 'name'>> = [
  { id: 'postgres', name: 'Postgres 18' },
  { id: 'disk', name: 'Disk' },
  { id: 'memory', name: 'Memory' },
  { id: 'smtp', name: 'Outbound email (SMTP)' },
  { id: 'https', name: 'HTTPS' },
  { id: 'backups', name: 'Backups' },
];

const STATUS: Record<SystemCheck['status'], HealthRowStatus> = {
  ok: 'ok',
  warn: 'warning',
  fail: 'failed',
};

/** One server check as a step-1 row. */
export function checkRow(check: SystemCheck): HealthRow {
  return {
    id: check.id,
    name: check.name,
    status: STATUS[check.status],
    detail: check.value,
    ...(check.fix?.href ? { fix: { label: check.fix.label, href: check.fix.href } } : {}),
    ...(check.fix && !check.fix.href ? { hint: check.fix.hint } : {}),
  };
}

/** The anonymous /readyz answer as the Postgres row, when the full check failed. */
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
 * Step 1's rows. GET /admin/system answers before any admin exists, so it is
 * the source; only when it fails does Postgres fall back to /readyz.
 */
export function healthRows(input: {
  system: SystemHealthResponse | undefined;
  systemError?: unknown;
  readiness?: ReadinessResponse | undefined;
  readinessError?: unknown;
}): HealthRow[] {
  if (input.system) return input.system.checks.map(checkRow);
  if (!input.systemError) {
    return ROWS.map((row) => ({ ...row, status: 'pending' as const, detail: 'Checking…' }));
  }
  return [
    databaseRow(input.readiness, input.readinessError),
    ...ROWS.slice(1).map((row) => ({ ...row, status: 'pending' as const, detail: PENDING_DETAIL })),
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

/** Step 1's health checks and the header's server line; signing in asks again. */
export function useSetupHealth(signedIn: boolean) {
  const system = useQuery({
    queryKey: [...queryKeys.system(), { signedIn }],
    queryFn: () => api.system.health(),
    retry: false,
  });
  const readiness = useQuery({
    queryKey: queryKeys.readiness(),
    queryFn: () => api.setup.readiness(),
    enabled: system.isError,
    retry: false,
  });
  const rows = healthRows({
    system: system.data,
    systemError: system.error,
    readiness: readiness.data,
    readinessError: readiness.error,
  });
  return {
    rows,
    headline: healthHeadline(rows),
    serverLabel: serverLabel(window.location.host, system.data?.version),
    loading: system.isPending || (system.isError && readiness.isPending),
    refetch: () => {
      void system.refetch();
      if (system.isError) void readiness.refetch();
    },
  };
}
