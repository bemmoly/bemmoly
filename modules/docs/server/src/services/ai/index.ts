import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  defineContextBuilder,
  defineInsightGenerator,
  type AiInsightGenerator,
  type EventBus,
  type ModuleContext,
  type SqlExecutor,
} from '@bemmoly/core';
import { AI_INSIGHT_EVENT_KINDS } from '@bemmoly/shared';
import { aiSourceChangedPayloadSchema, type PageTldrOutput } from '@bemmoly/shared/ai-insights';
import type { DocsServiceDeps } from '../common.ts';
import { createPageContextBuilder, createPagePairsBuilder } from './page-context.ts';
import { createDocsActivitySource, createIssueLinksSource } from './related.ts';

export {
  createPageContextBuilder,
  createPagePairsBuilder,
  PAGE_CONTEXT_LIMITS,
} from './page-context.ts';
export { createDocsActivitySource, createIssueLinksSource } from './related.ts';
export { issueParagraphPairs, pageSections } from './sections.ts';

export const DOCS_AI_BUILDERS = {
  page: 'docs.page',
  pairs: 'docs.page_pairs',
  issueLinks: 'docs.issue_links',
  activity: 'docs.activity',
} as const;

export const DOCS_PROMPT_FILES = {
  tldr: fileURLToPath(new URL('./prompts/tldr.md', import.meta.url)),
  consistency: fileURLToPath(new URL('./prompts/consistency.md', import.meta.url)),
} as const;

/** A linked issue's edits settle for a minute before its pages are re-checked. */
export const CONSISTENCY_QUIET_SECONDS = 60;

/** The hash of the text a TL;DR was written from: pages.tldr_source_hash. */
export const tldrSourceHash = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

/**
 * The page TL;DR regenerates only when the page text no longer matches tldr_source_hash
 * (or the privacy settings that shaped it change), and copies its text onto the page, where
 * backlinks and issue summaries read it.
 */
export function createTldrGenerator(sql: () => SqlExecutor | undefined): AiInsightGenerator {
  return {
    kind: 'page_tldr',
    builder: DOCS_AI_BUILDERS.page,
    promptId: 'docs.tldr',
    purpose: 'tldr',
    async stamp(pageId, { policy }) {
      const db = sql();
      if (!db) return null;
      const [page] = await db<{ text: string }[]>`
        select text from pages where id = ${pageId} and deleted_at is null`;
      if (!page?.text.trim()) return null;
      return `${tldrSourceHash(page.text)}:${policy.shareContent ? 'content' : 'titles'}`;
    },
    async afterStore(pageId, output) {
      const db = sql();
      if (!db) return;
      const text = (output as PageTldrOutput).points.map((point) => point.text).join(' ');
      await db`
        update pages set tldr = ${text}, tldr_source_hash = encode(sha256(convert_to(text, 'UTF8')), 'hex')
        where id = ${pageId}`;
    },
  };
}

export const consistencyGenerator: AiInsightGenerator = {
  kind: 'consistency',
  builder: DOCS_AI_BUILDERS.pairs,
  promptId: 'docs.consistency',
  purpose: 'consistency',
  refreshOnView: false,
  emptyOutput: (context) =>
    !context.source.counts['paragraphs'] || context.source.titlesOnly ? { findings: [] } : null,
};

/** Asks for consistency checks of the pages, after an optional quiet period. */
export async function requestConsistency(
  events: EventBus | undefined,
  pageIds: readonly string[],
  options: { quietSeconds?: number; transaction?: SqlExecutor } = {},
): Promise<void> {
  if (!events || pageIds.length === 0) return;
  await events.publish({
    kind: AI_INSIGHT_EVENT_KINDS.requested,
    occurredAt: new Date(),
    payload: {
      kind: 'consistency',
      targetIds: [...pageIds].slice(0, 200),
      quietSeconds: options.quietSeconds ?? 0,
    },
    ...(options.transaction ? { transaction: options.transaction } : {}),
  });
}

/**
 * Docs' AI: pageContext, the consistency pairs, the issue-links and activity sources, the
 * TL;DR and consistency generators and their prompts, and the trigger that re-checks pages
 * when an issue they name changes.
 */
export function registerDocsAi(
  ctx: Pick<ModuleContext, 'ai' | 'events'>,
  deps: Pick<DocsServiceDeps, 'database' | 'entities'>,
): void {
  const sql = () => deps.database;
  const add = (
    name: string,
    description: string,
    definition: Parameters<typeof defineContextBuilder>[2],
  ) => ctx.ai.addContextBuilder(defineContextBuilder(name, description, definition));
  add(
    DOCS_AI_BUILDERS.page,
    'A page by heading, its issues, comments and backlinks',
    createPageContextBuilder(deps),
  );
  add(
    DOCS_AI_BUILDERS.pairs,
    'Each issue a page names, beside its paragraph',
    createPagePairsBuilder(deps),
  );
  add(
    DOCS_AI_BUILDERS.issueLinks,
    'The pages that link an issue, with their TL;DRs',
    createIssueLinksSource(sql),
  );
  add(DOCS_AI_BUILDERS.activity, 'Pages that changed', createDocsActivitySource(sql));
  ctx.ai.addInsightGenerator(
    defineInsightGenerator('The TL;DR card on a page', createTldrGenerator(sql)),
  );
  ctx.ai.addInsightGenerator(
    defineInsightGenerator(
      'Contradictions between a page and the issues it names',
      consistencyGenerator,
    ),
  );
  ctx.ai.addExclusionSource({
    kind: 'space',
    /** Every live space, for Settings › AI › Privacy's exclusion picker. */
    async list() {
      const db = sql();
      if (!db) return [];
      return db<{ id: string; name: string; key: string }[]>`
        select id, name, key from spaces where archived_at is null order by key`;
    },
  });
  ctx.ai.addPromptFile({ name: 'docs.tldr', path: DOCS_PROMPT_FILES.tldr });
  ctx.ai.addPromptFile({ name: 'docs.consistency', path: DOCS_PROMPT_FILES.consistency });

  ctx.events.subscribe(AI_INSIGHT_EVENT_KINDS.sourceChanged, async (event) => {
    const parsed = aiSourceChangedPayloadSchema.safeParse(event.payload);
    const db = event.transaction ?? deps.database;
    if (!parsed.success || parsed.data.kind !== 'issue' || !db) return;
    const rows = await db<{ id: string }[]>`
      select distinct p.id from links l join pages p on p.id = l.source_id
      where l.source_kind = 'page' and l.target_kind = 'issue'
        and l.target_id = any(${parsed.data.ids}::uuid[])
        and p.deleted_at is null and p.status = 'published'`;
    await requestConsistency(
      ctx.events,
      rows.map((row) => row.id),
      {
        quietSeconds: CONSISTENCY_QUIET_SECONDS,
        ...(event.transaction ? { transaction: event.transaction } : {}),
      },
    );
  });
}
