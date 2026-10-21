import { describe, expect, it } from 'vitest';
import {
  createDashboardBodySchema,
  dashboardWidgetInputSchema,
  dashboardWidgetSchema,
  defaultDashboardWidgets,
  MAX_DASHBOARD_WIDGETS,
  newWidget,
  WIDGET_TYPES,
} from './dashboards.ts';
import { quarterBounds, quarterOf, shiftQuarter } from './quarter.ts';

const ID = '018f0000-0000-7000-8000-000000000001';

describe('dashboard widgets', () => {
  it('gives every built-in type a default that parses', () => {
    for (const type of WIDGET_TYPES.filter((item) => item !== 'pinned')) {
      expect(dashboardWidgetSchema.parse({ ...newWidget(type), id: ID }).type).toBe(type);
    }
  });

  it('starts a scrum dashboard with the sprint reports and a kanban one with flow', () => {
    expect(defaultDashboardWidgets('scrum').map((widget) => widget.type)).toEqual([
      'burndown',
      'burnup',
      'velocity',
      'cumulative-flow',
      'quarter',
    ]);
    expect(defaultDashboardWidgets('kanban').map((widget) => widget.type)).toEqual([
      'cumulative-flow',
      'created-resolved',
      'control-chart',
      'time-in-status',
      'quarter',
    ]);
  });

  it('checks each type against its own config', () => {
    const flow = { type: 'cumulative-flow', size: 'half' };
    expect(dashboardWidgetInputSchema.safeParse({ ...flow, config: { days: 30 } }).success).toBe(
      true,
    );
    expect(dashboardWidgetInputSchema.safeParse({ ...flow, config: { days: 31 } }).success).toBe(
      false,
    );
    expect(
      dashboardWidgetInputSchema.safeParse({ type: 'nope', size: 'half', config: {} }).success,
    ).toBe(false);
    expect(
      dashboardWidgetInputSchema.safeParse({
        type: 'quarter',
        size: 'full',
        config: { quarter: '2026-Q5' },
      }).success,
    ).toBe(false);
  });

  it('holds a pinned report spec as given, within its limits', () => {
    const spec = { version: 1, title: 'Bugs by owner', kind: 'chart.bar', params: { by: 'x' } };
    const parsed = dashboardWidgetInputSchema.parse({
      type: 'pinned',
      size: 'half',
      config: { spec },
    });
    expect(parsed.config).toEqual({ spec: { ...spec, source: 'assistant' } });
    const huge = { ...spec, params: { blob: 'x'.repeat(17_000) } };
    expect(
      dashboardWidgetInputSchema.safeParse({ type: 'pinned', size: 'half', config: { spec: huge } })
        .success,
    ).toBe(false);
    expect(
      dashboardWidgetInputSchema.safeParse({
        type: 'pinned',
        size: 'half',
        config: { spec: { ...spec, kind: 'Bad Kind' } },
      }).success,
    ).toBe(false);
  });

  it('caps a dashboard at its widget limit', () => {
    const widgets = Array.from({ length: MAX_DASHBOARD_WIDGETS + 1 }, () => newWidget('velocity'));
    expect(
      createDashboardBodySchema.safeParse({ name: 'Too many', projectId: 'PLT', widgets }).success,
    ).toBe(false);
  });
});

describe('quarters', () => {
  it('names the quarter an instant falls in and its bounds', () => {
    expect(quarterOf(Date.UTC(2026, 9, 21))).toBe('2026-Q4');
    expect(quarterOf(Date.UTC(2026, 0, 1))).toBe('2026-Q1');
    expect(quarterBounds('2026-Q4')).toEqual({
      start: Date.UTC(2026, 9, 1),
      end: Date.UTC(2027, 0, 1),
    });
  });

  it('steps across years', () => {
    expect(shiftQuarter('2026-Q4', 1)).toBe('2027-Q1');
    expect(shiftQuarter('2026-Q1', -1)).toBe('2025-Q4');
    expect(shiftQuarter('2026-Q2', -5)).toBe('2025-Q1');
  });
});
