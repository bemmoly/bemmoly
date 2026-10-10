import {
  AI_INSIGHT_KINDS,
  AI_REALTIME_KINDS,
  aiInsightSchema,
  type AiInsight,
  type AiInsightKind,
} from '@bemmoly/shared';
import { currentUser, emit, type MockDb } from '../db.ts';
import { cannedInsight } from '../seed/ai-insights.ts';
import { newId } from '../seed/time.ts';
import {
  fail,
  notFound,
  ok,
  type MockRequest,
  type MockResponse,
  type MockRoute,
} from '../types.ts';
import { aiEnabledFor } from './ai-state.ts';
import { docsState } from './docs-state.ts';
import { issueStore } from './work-issue-store.ts';

/*
 * The insight cache on the in-memory backend. The first read of a target answers "pending"
 * and the canned answer lands a moment later, as a regeneration would; "Try again" starts
 * over; "Not useful" is remembered. With AI off every read refuses as the server does.
 */

/** How long the mock "writes" an insight before it is ready. */
export const MOCK_INSIGHT_DELAY_MS = 900;

interface StoredInsight {
  id: string;
  requestedAt: number;
  generatedAt: string | null;
  feedback: AiInsight['feedback'];
  previous: AiInsight['content'];
}

const stores = new WeakMap<MockDb, Map<string, StoredInsight>>();

function storeOf(db: MockDb): Map<string, StoredInsight> {
  let store = stores.get(db);
  if (!store) {
    store = new Map();
    stores.set(db, store);
  }
  return store;
}

const TARGET_KINDS: Record<AiInsightKind, string> = {
  issue_summary: 'issue',
  page_tldr: 'page',
  sprint_pulse: 'sprint',
  morning_brief: 'user',
  consistency: 'page',
};

/** The target's own name and link, for the plain answers. */
function describe(db: MockDb, kind: AiInsightKind, targetId: string) {
  if (TARGET_KINDS[kind] === 'issue') {
    const issue = issueStore(db).issues.find((row) => row.id === targetId);
    return issue
      ? { title: String(issue['key']), href: `/work/issue/${String(issue['key'])}` }
      : null;
  }
  if (TARGET_KINDS[kind] === 'page') {
    const page = docsState(db).pages.find((row) => row.id === targetId);
    return page ? { title: page.title, href: `/docs/p/${page.id}` } : null;
  }
  if (TARGET_KINDS[kind] === 'sprint') {
    const sprint = issueStore(db).sprints.find((row) => row.id === targetId);
    return sprint ? { title: String(sprint['name']), href: '/work/board' } : null;
  }
  return { title: 'You', href: '/' };
}

function present(db: MockDb, kind: AiInsightKind, targetId: string, now = Date.now()): AiInsight {
  const stored = storeOf(db).get(`${kind}:${targetId}`)!;
  const writing = now - stored.requestedAt < MOCK_INSIGHT_DELAY_MS;
  const canned = cannedInsight(kind, targetId, describe(db, kind, targetId));
  const content = writing
    ? stored.previous
    : {
        output: canned.output,
        citations: canned.citations,
        source: { counts: canned.counts, titlesOnly: false },
      };
  if (!writing && !stored.generatedAt) stored.generatedAt = new Date(now).toISOString();
  return aiInsightSchema.parse({
    id: stored.id,
    kind,
    targetKind: TARGET_KINDS[kind],
    targetId,
    state: writing ? (stored.previous ? 'refreshing' : 'pending') : 'ready',
    error: null,
    generatedAt: writing ? null : stored.generatedAt,
    feedback: stored.feedback,
    content,
  });
}

function admit(db: MockDb, request: MockRequest): MockResponse | AiInsightKind {
  const kind = request.params['kind'] as AiInsightKind;
  if (!(AI_INSIGHT_KINDS as readonly string[]).includes(kind)) {
    return fail(400, 'validation_failed', 'The request is not valid');
  }
  if (!aiEnabledFor(db, currentUser(db)?.id ?? null)) {
    return fail(403, 'forbidden', 'AI is turned off for this workspace', { reason: 'ai_off' });
  }
  const targetId = request.params['targetId'] ?? '';
  if (kind !== 'morning_brief' && !describe(db, kind, targetId)) return notFound('That insight');
  return kind;
}

/** Announces the regenerated insight once the mock has "written" it. */
function announceLater(db: MockDb, targetId: string): void {
  setTimeout(() => emit(db, AI_REALTIME_KINDS.insight, [targetId]), MOCK_INSIGHT_DELAY_MS + 50);
}

export const aiInsightRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/ai/insights/:kind/:targetId',
    handle: (request, db) => {
      const kind = admit(db, request);
      if (typeof kind !== 'string') return kind;
      const targetId = request.params['targetId']!;
      const key = `${kind}:${targetId}`;
      if (!storeOf(db).has(key)) {
        storeOf(db).set(key, {
          id: newId(),
          requestedAt: Date.now(),
          generatedAt: null,
          feedback: null,
          previous: null,
        });
        announceLater(db, targetId);
      }
      return ok({ insight: present(db, kind, targetId) });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/ai/insights/:kind/:targetId/refresh',
    handle: (request, db) => {
      const kind = admit(db, request);
      if (typeof kind !== 'string') return kind;
      const targetId = request.params['targetId']!;
      const key = `${kind}:${targetId}`;
      const existing = storeOf(db).get(key);
      const previous = existing ? present(db, kind, targetId).content : null;
      storeOf(db).set(key, {
        id: existing?.id ?? newId(),
        requestedAt: Date.now(),
        generatedAt: null,
        feedback: null,
        previous,
      });
      announceLater(db, targetId);
      return ok({ insight: present(db, kind, targetId) }, 202);
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/ai/insights/:id/feedback',
    handle: (request, db) => {
      const stored = [...storeOf(db).values()].find((row) => row.id === request.params['id']);
      if (!stored) return notFound('That insight');
      const feedback = (request.body as { feedback?: unknown } | null)?.feedback;
      if (feedback !== 'useful' && feedback !== 'not_useful') {
        return fail(400, 'validation_failed', 'The request is not valid');
      }
      stored.feedback = feedback;
      return ok();
    },
  },
];
