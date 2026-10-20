import type { DiscoveryStatus } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { applicationsView } from './applications-step.ts';
import type { Discovery } from './use-discovery.ts';

/* Step 2 of setup as discovery moves: never a dead end once GitHub is connected. */

const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as Parameters<typeof applicationsView>[0];
const action = (label: string) => `[${label}]`;

const status = (over: Partial<DiscoveryStatus> = {}): DiscoveryStatus => ({
  repositories: 0,
  scanned: 0,
  failed: 0,
  scanning: false,
  lastSweep: {
    startedAt: '2026-10-20T06:00:00.000Z',
    finishedAt: '2026-10-20T06:00:04.000Z',
    repositories: 0,
    error: null,
  },
  ...over,
});
const discovery = (value: DiscoveryStatus | null, scanning = false): Discovery => ({
  status: value,
  scanning: scanning || value?.scanning === true,
  scanAgain: () => undefined,
});

describe('setup step 2', () => {
  it('runs on its own before the first sweep has finished, with no button to press', () => {
    const view = applicationsView(t, 'current', 0, discovery(status({ lastSweep: null })), action);
    expect(view).toEqual({ state: 'working', description: 'pipelines.start.applicationsListing' });
  });

  it('shows how far it got while repositories are scanned', () => {
    const view = applicationsView(
      t,
      'current',
      0,
      discovery(status({ repositories: 40, scanned: 12, failed: 2, scanning: true })),
      action,
    );
    expect(view.state).toBe('working');
    expect(view.description).toBe('pipelines.start.applicationsScanning {"scanned":14,"total":40}');
    expect(view.action).toBeUndefined();
  });

  it('offers the proposals as soon as there are some', () => {
    const view = applicationsView(t, 'current', 3, discovery(status({ scanning: true })), action);
    expect(view.action).toBe('[pipelines.start.review]');
  });

  it('says what it looked through and offers Scan again when it found nothing', () => {
    const view = applicationsView(
      t,
      'current',
      0,
      discovery(status({ repositories: 5, scanned: 4, failed: 1 })),
      action,
    );
    expect(view.state).toBe('current');
    expect(view.description).toBe(
      'pipelines.start.applicationsNone {"count":5} pipelines.start.applicationsUnread {"count":1}',
    );
    expect(view.action).toBe('[pipelines.start.scanAgain]');
  });

  it('shows why the hosts could not be asked, with Scan again', () => {
    const failed = status({
      lastSweep: { ...status().lastSweep!, error: 'GitHub refused the installation token' },
    });
    expect(applicationsView(t, 'current', 0, discovery(failed), action)).toEqual({
      state: 'failed',
      description: 'GitHub refused the installation token',
      action: '[pipelines.start.scanAgain]',
    });
  });

  it('keeps counting a sweep someone asked for as running until it starts', () => {
    const view = applicationsView(t, 'current', 0, discovery(status(), true), action);
    expect(view.state).toBe('working');
  });
});
