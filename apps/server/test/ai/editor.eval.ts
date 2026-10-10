import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  attributedBullets,
  keepsFacts,
  markdownTable,
  minimalDiff,
  noPreamble,
  prose,
  shortCompletion,
  taskList,
  type Verdict,
} from './checks.ts';
import { COMMENTS, RFC, nameOf } from './fixture/acme.ts';
import { evalCase, pass, replyOf } from './harness.ts';

/* The Docs editor's prompts: ghost text, the /ai write commands and a comment thread's fix. */

const ROLLBACK = RFC.sections[3]!;
const ROLLOUT = RFC.sections[2]!;
const sectionText = (section: typeof ROLLBACK) => section.paragraphs.join('\n\n');

describe('docs.autocomplete', () => {
  it('stays short: one line of at most 25 words that does not repeat the text', async () => {
    const { ai, save } = await evalCase('docs-autocomplete');
    const before = 'If error rates exceed 0.5% after cutover, we flip auth_pg_sessions off and';
    const prompt = await ai.facade.renderPrompt('docs.autocomplete', { before, after: '' });
    // The editor gives the fast role 1.5 s; a live eval allows more for a cold provider.
    const result = await ai.facade.generate({
      role: prompt.role,
      purpose: 'docs.autocomplete',
      system: prompt.system,
      prompt: prompt.prompt,
      promptRef: prompt.promptRef,
      maxOutputTokens: 60,
      temperature: 0.2,
      timeoutMs: 15_000,
    });
    await save(prompt.promptRef, [replyOf(result)]);
    const line = result.text.split('\n')[0]?.trimEnd() ?? '';
    expect(line.trim()).not.toBe('');
    pass(shortCompletion(line, before));
  });
});

describe('docs.comment_fix', () => {
  it('fixes only the quoted passage, with a minimal diff', async () => {
    const { ai, save } = await evalCase('docs-comment-fix');
    const thread = COMMENTS[0]!;
    const prompt = await ai.facade.renderPrompt('docs.comment_fix', {
      quote: thread.quote!,
      context: sectionText(ROLLBACK),
      thread: [
        `${nameOf(thread.author)}: ${thread.body}`,
        'Aisha K.: Code says 30 (auth/flags.go:41). Update the doc to 30 minutes?',
      ].join('\n'),
    });
    const result = await ai.facade.generate({
      role: prompt.role,
      purpose: 'docs.comment_fix',
      system: prompt.system,
      prompt: prompt.prompt,
      promptRef: prompt.promptRef,
      schema: z.object({ replacement: z.string().min(1), rationale: z.string() }),
    });
    await save(prompt.promptRef, [replyOf(result)]);
    const { replacement } = result.object;
    expect(replacement).toMatch(/\b30\b/);
    expect(replacement).not.toMatch(/\b15\b/);
    pass(minimalDiff(thread.quote!, replacement, 3));
  });
});

interface WriteCase {
  command: string;
  heading: string;
  section: string;
  target?: string;
  comments?: string;
  checks: (text: string, input: { target: string }) => Verdict[];
}

const GERMAN =
  'Wenn die Fehlerrate nach der Umstellung 0,5 % übersteigt, schalten wir auth_pg_sessions ab. Redis bleibt 7 Tage warm.';
const TYPOS =
  'If error rates exceed 0.5% after cutover, flip auth_pg_sessions off. Sesions issued by the new service stay valid for 15 minutes, so users arent logged out.';

const WRITES: WriteCase[] = [
  {
    command: 'continue',
    heading: 'Rollback',
    section: sectionText(ROLLBACK),
    target: ROLLBACK.paragraphs[1]!,
    checks: (text) => [noPreamble(text), prose(text, 160)],
  },
  {
    command: 'draft',
    heading: 'Testing plan',
    section: 'We test the session migration on staging before cutover.',
    target: 'We test the session migration on staging before cutover.',
    checks: (text) => [
      noPreamble(text),
      /^#{1,6} Testing plan/m.test(text) ? 'copied the heading' : null,
    ],
  },
  {
    command: 'create-issues',
    heading: 'Rollout plan',
    section: sectionText(ROLLOUT),
    target: ROLLOUT.paragraphs[3]!,
    checks: (text) => [taskList(text, 8)],
  },
  {
    command: 'summarize',
    heading: 'Rollback',
    section: sectionText(ROLLBACK),
    target: '',
    checks: (text) => [noPreamble(text), prose(text, 90), keepsFacts(text, ['auth_pg_sessions'])],
  },
  {
    command: 'summarize-comments',
    heading: 'Rollback',
    section: sectionText(ROLLBACK),
    comments: COMMENTS.filter((comment) => !comment.resolved)
      .map((c) => `${nameOf(c.author)} on "${c.quote ?? RFC.title}": ${c.body}`)
      .join('\n'),
    checks: (text) => [attributedBullets(text, ['Jonas M.'])],
  },
  {
    command: 'improve',
    heading: 'Rollback',
    section: sectionText(ROLLBACK),
    target: ROLLBACK.paragraphs[0]!,
    checks: (text) => [noPreamble(text), keepsFacts(text, ['0.5%', 'auth_pg_sessions', '15'])],
  },
  {
    command: 'shorten',
    heading: 'Rollback',
    section: sectionText(ROLLBACK),
    target: ROLLBACK.paragraphs[0]!,
    checks: (text, { target }) => [
      noPreamble(text),
      keepsFacts(text, ['0.5%', 'auth_pg_sessions', '15']),
      text.length <= target.length * 0.85 ? null : 'is not shorter than the original',
    ],
  },
  {
    command: 'fix-grammar',
    heading: 'Rollback',
    section: TYPOS,
    target: TYPOS,
    checks: (text, { target }) => [
      keepsFacts(text, ['Sessions', "aren't", 'auth_pg_sessions', '0.5%', '15 minutes']),
      minimalDiff(target, text, 4),
    ],
  },
  {
    command: 'table',
    heading: 'Rollout plan',
    section: sectionText(ROLLOUT),
    target: sectionText(ROLLOUT),
    checks: (text) => [markdownTable(text), keepsFacts(text, ['PLT-204', 'PLT-218', 'PLT-222'])],
  },
  {
    command: 'translate',
    heading: 'Rollback',
    section: GERMAN,
    target: GERMAN,
    checks: (text) => [
      noPreamble(text),
      keepsFacts(text, ['auth_pg_sessions', 'Redis', '7']),
      /\b(the|we|after)\b/i.test(text) ? null : 'does not read as English',
      /\b(wir|bleibt|nach der)\b/i.test(text) ? 'left German words in' : null,
    ],
  },
];

describe('docs.write commands keep the requested shape', () => {
  it.each(WRITES)('docs.write.$command', async (write) => {
    const { ai, save } = await evalCase(`docs-write-${write.command}`);
    const variables: Record<string, string> = { heading: write.heading, section: write.section };
    if (write.comments !== undefined) variables['comments'] = write.comments;
    else variables['target'] = write.target ?? '';
    const prompt = await ai.facade.renderPrompt(`docs.write.${write.command}`, variables);
    const stream = await ai.facade.stream({
      role: prompt.role,
      purpose: 'docs.write',
      system: prompt.system,
      prompt: prompt.prompt,
      promptRef: prompt.promptRef,
      maxOutputTokens: 1200,
    });
    let text = '';
    for await (const delta of stream.textStream) text += delta;
    await save(prompt.promptRef, [{ text }]);
    expect(text.trim()).not.toBe('');
    for (const verdict of write.checks(text.trim(), { target: write.target ?? '' })) pass(verdict);
  });
});
