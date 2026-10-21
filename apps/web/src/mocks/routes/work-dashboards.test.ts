import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';

/*
 * The Dashboards and quarter mocks behind the public demo: a dashboard starts with the
 * project's default reports, its layout is written whole, and the quarter answers for
 * Platform Core with UUID ids, since the screens validate every reply.
 */

const W = '/api/v1/work';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('work dashboards mock', () => {
  const api = createMockApi('ready');
  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown) =>
    api.dispatch(method, url, body);

  it('creates a dashboard with the default reports and keeps its layout', () => {
    expect(call('GET', `${W}/dashboards?projectId=PLT`)?.body).toEqual({ items: [] });
    const created = call('POST', `${W}/dashboards`, { name: 'Team', projectId: 'PLT' });
    expect(created?.status).toBe(201);
    const board = created?.body as { id: string; widgets: { id: string; type: string }[] };
    expect(board.widgets.map((widget) => widget.type)).toEqual([
      'burndown',
      'burnup',
      'velocity',
      'cumulative-flow',
      'quarter',
    ]);
    expect(board.widgets.every((widget) => UUID.test(widget.id))).toBe(true);

    const reversed = [...board.widgets].reverse();
    const saved = call('PATCH', `${W}/dashboards/${board.id}`, { widgets: reversed });
    expect((saved?.body as typeof board).widgets.map((widget) => widget.id)).toEqual(
      reversed.map((widget) => widget.id),
    );
    expect(
      call('PATCH', `${W}/dashboards/${board.id}`, { widgets: [reversed[0], reversed[0]] })?.status,
    ).toBe(400);

    const pinned = call('POST', `${W}/dashboards/${board.id}/widgets`, {
      widget: {
        type: 'pinned',
        size: 'half',
        config: { spec: { version: 1, title: 'Bugs', kind: 'chart.bar', params: {} } },
      },
      position: 0,
    });
    const pin = (pinned?.body as typeof board).widgets[0];
    expect(pin?.type).toBe('pinned');
    expect(call('DELETE', `${W}/dashboards/${board.id}/widgets/${pin?.id}`)?.status).toBe(204);
    expect(call('DELETE', `${W}/dashboards/${board.id}`)?.status).toBe(204);
    expect(call('GET', `${W}/dashboards/${board.id}`)?.status).toBe(404);
  });

  it('answers the quarter with weeks, sprints and epics', () => {
    const response = call('GET', `${W}/projects/PLT/reports/quarter`);
    expect(response?.status).toBe(200);
    const report = response?.body as {
      quarter: string;
      weeks: unknown[];
      sprints: { sprintId: string }[];
      epics: { epicId: string }[];
    };
    expect(report.quarter).toMatch(/^\d{4}-Q[1-4]$/);
    expect(report.weeks.length).toBeGreaterThan(0);
    expect(report.sprints.every((sprint) => UUID.test(sprint.sprintId))).toBe(true);
    expect(report.epics.every((epic) => UUID.test(epic.epicId))).toBe(true);
    const next = call('GET', `${W}/projects/PLT/reports/quarter?quarter=2099-Q1`);
    expect((next?.body as { weeks: unknown[] }).weeks).toEqual([]);
  });
});
