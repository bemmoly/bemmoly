/*
 * The eval index: every prompt id on the boot path, the eval file that covers it, the cases
 * (one recording each) and the golden checks they hold it to. coverage.eval.ts fails when a
 * prompt file has no entry here, or when a recording was made against an older version.
 */

export interface EvalEntry {
  promptId: string;
  file: string;
  /** Recording ids; a case listed in `silent` must never reach a model and has none. */
  cases: string[];
  silent?: string[];
  checks: string[];
}

const write = (command: string, checks: string[]): EvalEntry => ({
  promptId: `docs.write.${command}`,
  file: 'editor.eval.ts',
  cases: [`docs-write-${command}`],
  checks,
});

export const EVAL_INDEX: readonly EvalEntry[] = [
  {
    promptId: 'retrieval.answer',
    file: 'answers.eval.ts',
    cases: ['retrieval-answer-cited', 'retrieval-answer-unanswerable'],
    silent: ['retrieval-answer-no-sources'],
    checks: [
      'cites at least one offered source, invents none',
      'says NO_ANSWER when the sources are silent',
      'no sources: no model call and no run',
    ],
  },
  {
    promptId: 'ai.plan',
    file: 'plans.eval.ts',
    cases: ['ai-plan-named-issues', 'ai-plan-question'],
    checks: [
      'writes touch only the issues named',
      'moves to the sprint the reads returned',
      'a question proposes no write',
    ],
  },
  {
    promptId: 'docs.autocomplete',
    file: 'editor.eval.ts',
    cases: ['docs-autocomplete'],
    checks: ['one line', 'at most 25 words', 'does not repeat the text before the caret'],
  },
  {
    promptId: 'docs.comment_fix',
    file: 'editor.eval.ts',
    cases: ['docs-comment-fix'],
    checks: ['settles the thread (30, not 15)', 'minimal diff: at most 3 words changed'],
  },
  write('continue', ['no preamble', 'prose, no heading, at most 160 words']),
  write('draft', ['no preamble', 'does not copy the heading']),
  write('create-issues', ['task list "- [ ] Title — detail"', 'at most 8 items']),
  write('summarize', ['no preamble', 'at most 90 words', 'keeps the flag name']),
  write('summarize-comments', ['bulleted list', 'each question names who raised it']),
  write('improve', ['no preamble', 'keeps every number, name and flag']),
  write('shorten', ['no preamble', 'keeps its facts', 'at most 85% of the length']),
  write('fix-grammar', ['fixes the typos', 'minimal diff: at most 4 words changed']),
  write('table', ['Markdown table, 2 to 5 columns, even rows', 'keeps every issue key']),
  write('translate', ['reads as English', 'no German left', 'keeps names and numbers']),
  {
    promptId: 'work.issue_summary',
    file: 'insights.eval.ts',
    cases: ['work-issue-summary'],
    checks: [
      'every point cites an offered source',
      'next steps cite offered sources',
      '2 to 4 points',
    ],
  },
  {
    promptId: 'docs.tldr',
    file: 'insights.eval.ts',
    cases: ['docs-tldr'],
    checks: ['every point cites an offered source', 'at most 3 points', 'leads with the decision'],
  },
  {
    promptId: 'work.sprint_pulse',
    file: 'insights.eval.ts',
    cases: ['work-sprint-pulse'],
    checks: [
      'not on track while PLT-204 holds the sprint',
      'headline names PLT-204 in at most 30 words',
      'headline and next steps cite offered sources',
    ],
  },
  {
    promptId: 'ai.brief',
    file: 'insights.eval.ts',
    cases: ['ai-brief'],
    checks: ['leads with what waits on the person', 'every point cites', 'at most 4 points'],
  },
  {
    promptId: 'docs.consistency',
    file: 'insights.eval.ts',
    cases: ['docs-consistency'],
    checks: [
      'finds the planted 15 versus 30 minute rollback conflict on PLT-204',
      'locates it under Rollback, confidence at least 0.5, offered cites',
      'reports no other conflict',
    ],
  },
];
