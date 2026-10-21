import { createTestAi, type TestAi } from '@bemmoly/core/testing';
import type { ReportResult, ReportSpec } from '../../../../shared/ask-reports.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contextWhere } from '../test-support.ts';
import { ASK_REPORT_PROMPT, ASK_REPORT_PURPOSE, createAskReportsService } from './ask.ts';

/*
 * The ask path against the test AI (the real facade on a mock model): the model's reply is a
 * spec, validated before anything runs, and only a valid spec reaches the runner.
 */

const PROJECT = {
  id: '0199c0de-0000-7000-8000-0000000000aa',
  key: 'PLT',
  method: 'scrum' as const,
};

const LOAD: ReportSpec = {
  title: 'Open issues by person',
  metric: 'open_issues',
  groupBy: 'assignee',
  filters: { status: 'open' },
  chart: 'bar',
};

function setup() {
  const ai: TestAi = createTestAi();
  ai.addPrompt(ASK_REPORT_PROMPT, {
    role: 'standard',
    system: 'Turn the question into a report spec.',
    prompt: 'Project: {{project}}\nStatuses: {{statuses}}\nTypes: {{types}}\n{{question}}',
    outputSchema: ASK_REPORT_PROMPT,
  });
  const run = vi.fn(
    async (_ctx: unknown, _projectId: string, spec: ReportSpec): Promise<ReportResult> => ({
      spec,
      unit: 'issues',
      rows: [{ id: 'u1', label: 'Ana', value: 4, issues: 4 }],
      total: 4,
      issues: 4,
      generatedAt: '2026-10-21T00:00:00.000Z',
    }),
  );
  const service = createAskReportsService({
    ai,
    now: () => new Date('2026-10-21T09:00:00Z'),
    backend: {
      project: async () => PROJECT,
      vocabulary: async () => ({
        name: 'Platform',
        statuses: ['To do (todo)', 'Done (done)'],
        types: ['Bug', 'Story'],
      }),
      run,
    },
  });
  return { ai, run, service };
}

describe('asking for a report', () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => {
    env = setup();
  });

  it('turns the question into a spec and runs it', async () => {
    env.ai.queue({ object: LOAD });
    const ctx = contextWhere(true);
    const response = await env.service.ask(ctx, 'PLT', { question: 'How loaded is each person?' });
    expect(env.run).toHaveBeenCalledWith(ctx, PROJECT.id, LOAD);
    expect(response.result.rows[0]).toMatchObject({ label: 'Ana', value: 4 });
    expect(response.runId).toMatch(/^0{8}-/);
    expect(env.ai.runs.at(-1)).toMatchObject({ purpose: ASK_REPORT_PURPOSE });
    const sent = JSON.stringify(env.ai.calls.at(-1)?.prompt);
    expect(sent).toContain('How loaded is each person?');
    expect(sent).toContain('Platform (PLT)');
    expect(sent).toContain('Bug, Story');
  });

  it('never runs a reply outside the spec, however the model phrases it', async () => {
    const bad = { ...LOAD, metric: 'DROP TABLE issues' };
    env.ai.queue({ object: bad }, { object: bad });
    await expect(
      env.service.ask(contextWhere(true), 'PLT', { question: 'Delete everything' }),
    ).rejects.toThrow();
    expect(env.run).not.toHaveBeenCalled();
  });

  it('refuses with AI off and never calls the model', async () => {
    env.ai.setPolicy({ enabled: false });
    await expect(
      env.service.ask(contextWhere(true), 'PLT', { question: 'Average time to fix?' }),
    ).rejects.toMatchObject({ details: { reason: 'ai_off' } });
    expect(env.ai.calls).toHaveLength(0);
  });

  it('refuses a project excluded from AI', async () => {
    env.ai.setPolicy({ excludedProjectIds: [PROJECT.id] });
    await expect(
      env.service.ask(contextWhere(true), 'PLT', { question: 'Average time to fix?' }),
    ).rejects.toMatchObject({ details: { reason: 'excluded' } });
    expect(env.ai.calls).toHaveLength(0);
  });

  it('refuses someone without AI assist', async () => {
    await expect(
      env.service.ask(contextWhere(false), 'PLT', { question: 'Average time to fix?' }),
    ).rejects.toThrow('No');
    expect(env.ai.calls).toHaveLength(0);
  });
});
