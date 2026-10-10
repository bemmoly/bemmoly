import {
  ANSWER_PROMPT_ID,
  answerVariables,
  createRetrievalService,
  NO_ANSWER,
  type RequestContext,
  type RetrievedChunk,
} from '@bemmoly/core';
import type { AiAnswerEvent, AiAnswerSource } from '@bemmoly/shared/ai-answers';
import { describe, expect, it } from 'vitest';
import { answerCites } from './checks.ts';
import { RFC, RUNBOOK, issueByKey } from './fixture/acme.ts';
import { evalCase, pass } from './harness.ts';

/* retrieval.answer: "Ask your docs" over the Acme Labs pages and issues. */

const source = (id: string, title: string, label: string, href: string): AiAnswerSource => ({
  id,
  kind: href.startsWith('/docs') ? 'docs.page' : 'work.issue',
  targetId: `${id}-target`,
  title,
  href,
  location: { label },
  noun: href.startsWith('/docs')
    ? { one: 'page', other: 'pages' }
    : { one: 'issue', other: 'issues' },
});

const CHUNKS: RetrievedChunk[] = [
  {
    source: source('c1', RFC.title, 'Rollback', `/docs/p/${RFC.id}#rollback`),
    text: RFC.sections[3]!.paragraphs.join('\n'),
  },
  {
    source: source('c2', RUNBOOK.title, 'Turning the flag off', `/docs/p/${RUNBOOK.id}#flag-off`),
    text: RUNBOOK.sections[0]!.paragraphs.join('\n'),
  },
  {
    source: source('c3', 'PLT-204', 'Description', '/work/issues/PLT-204'),
    text: issueByKey('PLT-204')!.description,
  },
];
const OFFERED = new Set(CHUNKS.map((chunk) => chunk.source.id));

/** The call answerQuestion makes, with the same settings. */
async function ask(caseId: string, question: string) {
  const { ai, save } = await evalCase(caseId);
  const prompt = await ai.facade.renderPrompt(ANSWER_PROMPT_ID, answerVariables(question, CHUNKS));
  const stream = await ai.facade.stream({
    role: 'standard',
    purpose: 'qa',
    system: prompt.system,
    prompt: prompt.prompt,
    promptRef: prompt.promptRef,
    maxOutputTokens: 700,
    temperature: 0.2,
  });
  let streamed = '';
  for await (const delta of stream.textStream) streamed += delta;
  const result = await stream.result;
  await save(prompt.promptRef, [{ text: result.text }]);
  return { text: result.text.trim(), streamed };
}

describe('retrieval.answer', () => {
  it('answers from the sources and cites them', async () => {
    const { text } = await ask(
      'retrieval-answer-cited',
      'How long do sessions stay valid after auth_pg_sessions is turned off?',
    );
    expect(text).not.toBe(NO_ANSWER);
    pass(answerCites(text, OFFERED));
  });

  it('says NO_ANSWER when the sources do not answer, rather than guess', async () => {
    const { text } = await ask(
      'retrieval-answer-unanswerable',
      'Which vendor do we use for payroll?',
    );
    expect(text).toBe(NO_ANSWER);
  });

  it('makes no model call when nothing relevant is found', async () => {
    const { ai } = await evalCase('retrieval-answer-no-sources');
    const service = createRetrievalService({
      sql: undefined as never,
      ai: () => ai.facade,
      sources: () => [],
      keyword: () => [],
      isEnabled: () => true,
    });
    const ctx = {
      actor: { kind: 'user', id: 'u-rohan' },
      authz: { modulesFor: async () => new Set<string>() },
    } as unknown as RequestContext;
    const events: AiAnswerEvent[] = [];
    for await (const event of await service.answer(ctx, { question: 'What is our rollback?' })) {
      events.push(event);
    }
    expect(events).toEqual([
      { type: 'sources', sources: [] },
      { type: 'done', outcome: 'no_sources', runId: null, text: '', cited: [] },
    ]);
    expect(ai.modelRequests()).toBe(0);
    expect(ai.runs).toHaveLength(0);
  });
});
