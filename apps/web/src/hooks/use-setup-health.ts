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

/** One server check as a row of the first step's details. */
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
 * The first step's rows. GET /admin/system answers before any admin exists, so it is
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

export type HealthTone = 'ok' | 'warning' | 'failed' | 'pending';

/** Settings pages a check can point at, named as the Settings sidebar names them. */
const SETTINGS_PAGES: Record<string, string> = {
  '/settings/email': 'Email',
  '/settings/backups': 'Storage and backups',
  '/settings/system': 'System status',
  '/settings/updates': 'Updates',
};

/**
 * What to do about a check, in words: the wizard never links out of itself, so a fix with a
 * Settings page reads "Configure later in Settings › Email".
 */
export function fixLater(row: HealthRow): string | null {
  if (row.fix) {
    const page = SETTINGS_PAGES[row.fix.href];
    return page ? `Configure later in Settings › ${page}` : 'Configure later in Settings';
  }
  return row.hint ?? null;
}

function worst(rows: readonly HealthRow[]): HealthTone {
  for (const tone of ['failed', 'warning', 'pending'] as const) {
    if (rows.some((row) => row.status === tone)) return tone;
  }
  return 'ok';
}

/** "38 GB free of 80 GB" → "38 GB free"; "nightly to /var/…" → "backups nightly". */
function highlights(rows: readonly HealthRow[]): string[] {
  const byId = (id: string) => rows.find((row) => row.id === id && row.status === 'ok');
  const database = byId('postgres');
  const disk = byId('disk');
  const backups = byId('backups');
  return [
    database?.name,
    disk?.detail.split(' of ')[0],
    backups ? `backups ${backups.detail.split(' ')[0]}` : undefined,
  ].filter((part): part is string => Boolean(part));
}

/** The one line the checks collapse to, and whether the list should open on its own. */
export function healthSummary(rows: readonly HealthRow[]): {
  tone: HealthTone;
  text: string;
  open: boolean;
} {
  const tone = worst(rows);
  const database = rows.find((row) => row.id === 'postgres');
  if (database?.status === 'failed') {
    return { tone, text: `Bemmoly cannot reach Postgres: ${database.detail}`, open: true };
  }
  if (tone === 'pending' && !rows.some((row) => row.status === 'ok')) {
    return { tone, text: 'Checking the server…', open: false };
  }
  const attention = rows.filter((row) => row.status === 'warning' || row.status === 'failed');
  const lead = tone === 'failed' ? 'Server needs attention' : 'Server healthy';
  const tail = attention.length
    ? attention.length === 1
      ? `${attention[0]?.name} to set up`
      : `${attention.length} things to set up`
    : highlights(rows).join(', ');
  return { tone, text: [lead, tail].filter(Boolean).join(' · '), open: attention.length > 0 };
}

/**
 * The header chip. The web build and the server ship as one image, so the version this page
 * was built from is the version running; it is never typed by hand.
 */
export function versionLabel(version: string = __APP_VERSION__): string {
  return `Self-hosted · ${version}`;
}

/** The first step's health checks and the header's version chip; signing in asks again. */
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
    summary: healthSummary(rows),
    versionLabel: versionLabel(),
    loading: system.isPending || (system.isError && readiness.isPending),
    refetch: () => {
      void system.refetch();
      if (system.isError) void readiness.refetch();
    },
  };
}
