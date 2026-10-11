import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AiAnswerSource } from '@bemmoly/shared/ai-answers';
import { describe, expect, it } from 'vitest';
import { parsePromptFile } from '../prompts/parse.ts';
import { createPromptService } from '../prompts/service.ts';
import { ANSWER_PROMPT_FILE, ANSWER_PROMPT_ID, answerVariables, NO_ANSWER } from './prompt.ts';
import type { RetrievedChunk } from './retrieve.ts';

const source = (id: string, title: string, label = ''): AiAnswerSource => ({
  id,
  kind: 'docs.page',
  targetId: `page-${id}`,
  title,
  href: `/docs/p/${id}`,
  location: { label },
  noun: { one: 'page', other: 'pages' },
});

const chunks: RetrievedChunk[] = [
  { source: source('c1', 'Release checklist', 'Rollback'), text: 'Roll back within 15 minutes.' },
  { source: source('c2', 'On-call runbook'), text: 'Page the on-call lead first.' },
];

describe('the "Ask your docs" prompt file', () => {
  it('keeps its id and version, and the NO_ANSWER rule the answer gate reads', async () => {
    const prompt = parsePromptFile(await readFile(ANSWER_PROMPT_FILE, 'utf8'), ANSWER_PROMPT_FILE);
    expect(prompt).toMatchObject({
      id: ANSWER_PROMPT_ID,
      version: 1,
      role: 'standard',
      variables: ['sources', 'question'],
      output_schema: null,
    });
    expect(ANSWER_PROMPT_ID).toBe('retrieval.answer');
    expect(prompt.system).toContain(`reply with exactly ${NO_ANSWER} and nothing else`);
    expect(prompt.system).toContain('like [c1, c3]');
  });

  it('renders the numbered sources, then the question, as the model reads them', async () => {
    const service = createPromptService({ kernelFiles: [ANSWER_PROMPT_FILE] });
    await service.load();
    const rendered = await service.render(
      ANSWER_PROMPT_ID,
      answerVariables('How fast do we roll back?', chunks),
    );
    expect(rendered.promptRef).toEqual({ id: 'retrieval.answer', version: 1 });
    expect(rendered.role).toBe('standard');
    expect(rendered.prompt).toBe(
      [
        'Sources:',
        '',
        '[c1] Release checklist (Rollback)',
        'Roll back within 15 minutes.',
        '',
        '[c2] On-call runbook',
        'Page the on-call lead first.',
        '',
        'Question: How fast do we roll back?',
      ].join('\n'),
    );
  });

  it('is listed for Settings › AI › Prompts, so an admin can override it', async () => {
    const service = createPromptService({ kernelFiles: [ANSWER_PROMPT_FILE] });
    await service.load();
    const [listed] = await service.list();
    expect(listed).toMatchObject({ id: 'retrieval.answer', version: 1, override: null });
    expect(listed?.defaultTemplate).toMatch(/^# System\n\nYou answer questions/);
  });

  it('never re-reads braces inside a source as a variable', async () => {
    const service = createPromptService({ kernelFiles: [ANSWER_PROMPT_FILE] });
    await service.load();
    const rendered = await service.render(
      ANSWER_PROMPT_ID,
      answerVariables('What is {{question}}?', [
        { source: source('c1', 'Templates'), text: 'Write {{sources}} literally.' },
      ]),
    );
    expect(rendered.prompt).toContain('Write {{sources}} literally.');
    expect(rendered.prompt).toContain('Question: What is {{question}}?');
  });
});

describe('kernel prompt namespaces', () => {
  it('takes "ai." and "retrieval." ids from kernel files and refuses any other', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bemmoly-prompts-'));
    const path = join(dir, 'stray.md');
    await writeFile(
      path,
      '---\nid: work.stray\nversion: 1\nrole: fast\ndescription: x\n---\n# Prompt\n\nHi\n',
    );
    const service = createPromptService({ kernelFiles: [ANSWER_PROMPT_FILE, path] });
    await expect(service.load()).rejects.toThrow(/must start with "ai\." or "retrieval\."/);
  });
});
