import type { RequestContext, StartSourceDefinition } from '@bemmoly/core';
import type { ModuleStartSummaryInput } from '@bemmoly/shared';
import type { HomePage } from '../../../../shared/home.ts';
import { pagePath } from '../palette/index.ts';
import type { AttentionService } from './attention.ts';
import type { HomeService } from './index.ts';

const LIMIT = 5;

const where = (page: HomePage) => page.ancestors.at(-1)?.title ?? page.spaceKey;

const REASON = {
  review: 'Review requested',
  stale: 'Due for a refresh',
  consistency: 'AI found inconsistencies',
} as const;

/**
 * Docs' part of the start page: reviews the person was asked for are what waits on them;
 * "needs you" is the Docs home's attention list; recent is the pages they edited last.
 */
export function createDocsStartSource(home: AttentionService & Pick<HomeService, 'recent'>) {
  return {
    async summaryForUser(ctx: RequestContext): Promise<ModuleStartSummaryInput> {
      const [attention, recent] = await Promise.all([
        home.attention(ctx, { limit: LIMIT }),
        home.recent(ctx, { mine: true, limit: LIMIT }),
      ]);
      const reviews = attention.items.filter((item) => item.kind === 'review').length;
      return {
        waiting: { count: reviews, label: reviews === 1 ? 'page to review' : 'pages to review' },
        needsYou: attention.items.map((item) => ({
          id: `page:${item.page.id}`,
          title: item.page.title || 'Untitled',
          context: `${REASON[item.kind]} · ${where(item.page)}`,
          path: pagePath(item.page.id),
          at: item.since,
        })),
        recent: recent.items.map((page) => ({
          id: `page:${page.id}`,
          title: page.title || 'Untitled',
          context: where(page),
          path: pagePath(page.id),
          at: page.updatedAt,
        })),
      };
    },
  } satisfies StartSourceDefinition;
}
