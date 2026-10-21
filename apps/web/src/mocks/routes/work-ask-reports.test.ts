import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';
import { specFor } from './work-ask-reports.ts';

/* Asked and pinned reports in the demo: the suggested questions answer, and a pin re-runs. */

const W = '/api/v1/work';

describe('work ask reports mock', () => {
  it('reads the suggested questions as the prompt would', () => {
    expect(specFor('What is the average time to fix a bug?').metric).toBe('avg_resolution_days');
    expect(specFor('How loaded is each person?')).toMatchObject({
      metric: 'open_issues',
      groupBy: 'assignee',
    });
    expect(
      specFor('Which epics are in the current sprint and how far along is each?'),
    ).toMatchObject({ metric: 'progress', groupBy: 'epic', filters: { sprint: 'active' } });
  });

  it('answers a question, pins it and rebuilds the pin', () => {
    const api = createMockApi('ready');
    const asked = api.dispatch('POST', `${W}/projects/PLT/reports/ask`, {
      question: 'How loaded is each person?',
    });
    expect(asked?.status).toBe(200);
    const body = asked?.body as { question: string; result: { spec: unknown; rows: unknown[] } };
    expect(body.result.rows.length).toBeGreaterThan(0);

    const pinned = api.dispatch('POST', `${W}/projects/PLT/pinned-reports`, {
      question: body.question,
      spec: body.result.spec,
    });
    expect(pinned?.status).toBe(201);
    const list = api.dispatch('GET', `${W}/projects/PLT/pinned-reports`, undefined);
    const items = (list?.body as { items: { id: string; result: unknown }[] }).items;
    expect(items).toHaveLength(1);
    expect(items[0]?.result).toBeTruthy();

    const removed = api.dispatch('DELETE', `${W}/pinned-reports/${items[0]?.id}`, undefined);
    expect(removed?.status).toBe(204);
  });
});
