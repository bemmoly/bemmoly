import { ApiError } from '@bemmoly/api-client';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seedSystem } from '../mocks/seed/operations.ts';
import { renderQueryHook, testQueryClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import {
  checkRow,
  fixLater,
  healthRows,
  healthSummary,
  PENDING_DETAIL,
  useSetupHealth,
  versionLabel,
} from './use-setup-health.ts';

describe('setup health rows', () => {
  it('maps the server checks to step-1 rows', () => {
    const rows = healthRows({ system: seedSystem() });
    expect(rows.map((row) => row.status)).toEqual(['ok', 'ok', 'ok', 'warning', 'ok', 'ok']);
    expect(rows[0]).toMatchObject({ name: 'Postgres 18', detail: 'localhost:5432 · 12 ms' });
    expect(rows[3]?.fix).toEqual({ label: 'Configure', href: '/settings/email' });
    expect(fixLater(rows[3]!)).toBe('Configure later in Settings › Email');
    expect(healthSummary(rows)).toMatchObject({ tone: 'warning', open: true });
  });

  it('keeps a fix without a page as a hint', () => {
    const row = checkRow({
      id: 'https',
      name: 'HTTPS',
      status: 'fail',
      value: 'certificate expired',
      fix: { label: 'Renew', hint: 'Run bemmoly tls renew on the server.' },
    });
    expect(row).toMatchObject({ status: 'failed', hint: 'Run bemmoly tls renew on the server.' });
    expect(row.fix).toBeUndefined();
  });

  it('falls back to /readyz for Postgres only when the full check fails', () => {
    const readiness = {
      status: 'unavailable' as const,
      checks: { database: { status: 'failed' as const, message: 'connection refused' } },
    };
    const rows = healthRows({
      system: undefined,
      systemError: new ApiError(500, 'internal_error', 'boom'),
      readiness,
    });
    expect(rows[0]).toMatchObject({ status: 'failed', detail: 'connection refused' });
    expect(rows.slice(1).every((row) => row.detail === PENDING_DETAIL)).toBe(true);
    expect(healthSummary(rows)).toMatchObject({ tone: 'failed', open: true });
    expect(healthSummary(rows).text).toContain('connection refused');
  });

  it('collapses healthy checks to one line of highlights', () => {
    const rows = healthRows({ system: seedSystem() }).map((row) => ({
      ...row,
      status: 'ok' as const,
    }));
    const summary = healthSummary(rows);
    expect(summary).toMatchObject({ tone: 'ok', open: false });
    expect(summary.text.startsWith('Server healthy · Postgres 18')).toBe(true);
  });

  it('labels the chip with the version the page was built from', () => {
    expect(versionLabel('0.3.0')).toBe('Self-hosted · 0.3.0');
  });
});

describe('useSetupHealth', () => {
  it('reads the full checks anonymously before any admin exists', async () => {
    mockApi.reset('fresh');
    const { result } = await renderQueryHook(() => useSetupHealth(false), testQueryClient());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows.map((row) => row.id)).toEqual(
      mockApi.db.system.checks.map((check) => check.id),
    );
    expect(result.current.rows[3]?.status).toBe('warning');
    expect(result.current.versionLabel).toBe(versionLabel());
    expect(result.current.summary.open).toBe(true);
  });

  it('reads the same checks for a signed-in admin', async () => {
    const { result } = await renderQueryHook(() => useSetupHealth(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toHaveLength(6);
    expect(result.current.rows.every((row) => row.status !== 'pending')).toBe(true);
  });
});
