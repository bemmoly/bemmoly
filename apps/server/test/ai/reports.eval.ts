import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { evalCase, replyOf } from './harness.ts';

/*
 * Reports asked for in words: the prompt is called as the ask-reports service calls it
 * (structured output against the report spec, temperature 0) over the Acme Labs PLT project,
 * and the spec it returns must pick the options the question names. Apps never import a
 * module, so the spec's shape is restated here with only what the checks read.
 */

const reportSpecSchema = z.object({
  title: z.string().min(1),
  metric: z.string(),
  groupBy: z.string(),
  filters: z.object({
    sprint: z.string().optional(),
    types: z.array(z.string()).optional(),
  }),
  chart: z.string(),
});

type ReportSpec = z.infer<typeof reportSpecSchema>;

describe('work.report_spec', () => {
  it('turns open bugs per person in this sprint into a grouped, filtered bar report', async () => {
    const { ai, save } = await evalCase('work-report-spec');
    const prompt = await ai.facade.renderPrompt('work.report_spec', {
      project: 'Platform (PLT)',
      statuses: 'To do (todo), In progress (in_progress), Code review (in_progress), Done (done)',
      types: 'Story, Bug, Task, Epic',
      today: '2026-10-21',
      question: 'How many open bugs does each person have in the current sprint?',
    });
    expect(prompt.outputSchema).toBe('work.report_spec');
    const result = await ai.facade.generate<ReportSpec>({
      role: prompt.role,
      purpose: 'work.report_ask',
      system: prompt.system,
      prompt: prompt.prompt,
      promptRef: prompt.promptRef,
      schema: reportSpecSchema,
      temperature: 0,
      maxOutputTokens: 400,
      actor: null,
    });
    await save(prompt.promptRef, [replyOf(result)]);
    const spec = reportSpecSchema.parse(result.object);
    expect(spec.metric).toBe('open_issues');
    expect(spec.groupBy).toBe('assignee');
    expect(spec.filters.sprint).toBe('active');
    expect(spec.filters.types?.map((type) => type.toLowerCase())).toEqual(['bug']);
    expect(spec.chart).toBe('bar');
  });
});
