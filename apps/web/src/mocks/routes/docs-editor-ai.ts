import { can, emit, type MockDb } from '../db.ts';
import { bodyOf, fail, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { aiEnabledFor } from './ai-state.ts';
import { commentOf, present } from './docs-comments.ts';
import { docsState, live } from './docs-state.ts';

/*
 * AI inside the Docs editor for the demo and the mock backend: canned ghost text, /ai writes
 * streamed line by line as NDJSON, and a suggested fix on a thread. Refuses as the server
 * does: 403 with a reason when AI is off or the space is excluded.
 */

const BASE = '/api/v1/docs';
const NDJSON = { 'content-type': 'application/x-ndjson; charset=utf-8' };

const refuse = (reason: string, message: string) => fail(403, 'forbidden', message, { reason });

/** The page's space must allow AI and the person must be able to edit; null when it may go. */
function gate(db: MockDb, pageId: string | undefined) {
  const state = docsState(db);
  const page = state.pages.find((row) => row.id === pageId);
  if (!page || !live(page)) return notFound('The page');
  if (!can(db, 'docs.page.edit')) return fail(403, 'forbidden', 'You cannot edit this page');
  if (!aiEnabledFor(db, db.signedInAs))
    return refuse('ai_off', 'AI is turned off for this workspace');
  const space = state.spaces.find((row) => row.id === page.spaceId);
  if (space?.aiExcluded) return refuse('excluded', 'This content is excluded from AI');
  return null;
}

/** A continuation that reads as the next words, chosen by how the line ends. */
function continuation(before: string): string | null {
  const line = before.split('\n').at(-1)?.trim() ?? '';
  if (line.length < 12) return null;
  if (/[.!?]$/.test(line)) return ' Reads switch over once the backfill shows no mismatches.';
  if (/postgres$/i.test(line)) return ' behind the session.store flag, with dual writes first.';
  if (/\b(to|the|a|on|in|for|with)$/i.test(line)) return ' the on-call engineer before cutover.';
  return ', then we watch the error rate for a full day.';
}

const WRITES: Record<string, (target: string, heading: string) => string> = {
  continue: () =>
    'Once dual writes have run for a week with no mismatches, reads move to Postgres behind the same flag. Redis stays warm for seven days so a rollback is a flag flip, not a restore.',
  'summarize-comments': () =>
    '- Should the flag TTL be 15 or 30 minutes? (Jonas M.)\n- Who owns removing the legacy cookie path? (Rohan S.)',
  'create-issues': () =>
    '- [ ] Add dual writes behind session.store — writes go to Redis and Postgres.\n- [ ] Backfill sessions to Postgres — copy live sessions and verify counts.\n- [ ] Cut reads over to Postgres — flip the flag for 10%, then everyone.',
  summarize: (_target, heading) =>
    `${heading || 'This section'} moves sessions from Redis to Postgres behind a flag: dual writes first, then a backfill, then reads, with Redis kept warm for a fast rollback.`,
  draft: (_target, heading) =>
    `${heading ? `For ${heading.toLowerCase()}, ` : ''}we start with dual writes behind the session.store flag and compare both stores daily. When a week passes with no mismatches, reads move over in two steps, 10% and then everyone. [owner] signs off before each step.`,
  improve: (target) =>
    target.trim().split(/\s+/).length < 4
      ? target.trim()
      : target
          .replace(/\bwe moves\b/i, 'we move')
          .replace(/\s+/g, ' ')
          .replace(/^\w/, (first) => first.toUpperCase())
          .trim(),
  shorten: (target) => target.split(/[,.;]/)[0]?.trim().concat('.') ?? target,
  'fix-grammar': (target) => target.replace(/\bwe moves\b/gi, 'we move').replace(/\bteh\b/g, 'the'),
  translate: (target) => target,
  table: () =>
    '| Step | Store | When |\n| --- | --- | --- |\n| Dual write | Redis and Postgres | Week 1 |\n| Backfill | Postgres | Week 2 |\n| Cut reads | Postgres | Week 3 |',
};

/** The write as NDJSON lines: a few words a line, then done. */
function ndjson(text: string): string {
  const words = text.split(/(?<=\s)/);
  const lines: string[] = [];
  for (let at = 0; at < words.length; at += 3) {
    lines.push(JSON.stringify({ type: 'text', text: words.slice(at, at + 3).join('') }));
  }
  lines.push(JSON.stringify({ type: 'done', runId: null }));
  return `${lines.join('\n')}\n`;
}

export const docsEditorAiRoutes: readonly MockRoute[] = [
  {
    method: 'POST',
    pattern: `${BASE}/pages/:pageId/completions`,
    handle: (request: MockRequest, db) => {
      const refused = gate(db, request.params['pageId']);
      if (refused) return refused;
      const { before = '' } = bodyOf<{ before: string }>(request);
      return ok({ text: continuation(before) });
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/pages/:pageId/ai-writes`,
    handle: (request, db) => {
      const refused = gate(db, request.params['pageId']);
      if (refused) return refused;
      const body = bodyOf<{ command: string; targetText: string; heading: string }>(request);
      const write = WRITES[body.command ?? ''];
      if (!write) return fail(400, 'validation_failed', 'That is not an /ai command');
      const text = write(body.targetText ?? '', body.heading ?? '');
      return { status: 200, body: ndjson(text), headers: NDJSON, lineDelayMs: 70 };
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/comments/:commentId/suggest-fix`,
    handle: (request, db) => {
      const comment = commentOf(db, request);
      if (!comment) return notFound('The thread');
      const refused = gate(db, comment.pageId);
      if (refused) return refused;
      if (!comment.anchor || comment.parentId) {
        return fail(400, 'validation_failed', 'A fix belongs on a thread about some text');
      }
      const quote = comment.anchor.quote;
      const replacement = /15 minutes/.test(quote)
        ? quote.replace('15 minutes', '30 minutes')
        : `${quote.trim()} (owner: [name], tracked as an issue)`;
      comment.aiSuggestion = {
        replacement,
        rationale: /15 minutes/.test(quote)
          ? 'The flag TTL in code is 30 minutes.'
          : 'The thread asks who owns this, so the line names a placeholder owner.',
        appliedAt: null,
      };
      emit(db, 'docs.comments', [comment.pageId]);
      return ok(present(db, comment));
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/ai/runs/:id/feedback',
    handle: () => ok(),
  },
];
