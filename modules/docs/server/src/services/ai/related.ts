import type { AiActivitySource, AiRelatedSource, SqlExecutor } from '@bemmoly/core';
import { pagePath } from '../palette/index.ts';
import { readPagesLinking } from './page-rows.ts';

export const DOCS_ACTIVITY_LIMIT = 15;

/**
 * Docs' answer when another module's context asks what links an issue ("issue.links"):
 * the pages that embed or name it, with their TL;DRs as the body.
 */
export function createIssueLinksSource(sql: () => SqlExecutor | undefined): AiRelatedSource {
  return {
    type: 'related',
    targetKinds: ['issue.links'],
    async collect(writer, target) {
      const db = sql();
      if (!db) return;
      const pages = (await readPagesLinking(db, { kind: 'issue', id: target.id }, 5)).filter(
        (page) => !page.spaceExcluded && !writer.excluded({ spaceId: page.spaceId }),
      );
      if (pages.length > 0) writer.heading('Linked docs');
      for (const page of pages) {
        writer.cite({
          kind: 'page',
          objectId: page.id,
          label: page.title,
          location: 'TL;DR',
          href: pagePath(page.id),
          line: page.tldr ? `${page.title} (TL;DR below)` : page.title,
          body: page.tldr,
          scope: { spaceId: page.spaceId, authorId: page.authorId },
          counts: 'docs',
        });
      }
    },
  };
}

interface ChangedPage {
  id: string;
  title: string;
  status: string;
  spaceId: string;
  spaceExcluded: boolean;
  yours: boolean;
  reviewer: boolean;
  edited: boolean;
  comments: number;
  lastCommentAuthorId: string | null;
  lastCommentAuthor: string | null;
  lastComment: string | null;
}

/**
 * Docs' share of the morning brief: pages in the person's spaces edited or commented on
 * since their last visit, reviews asked of them first, then their own pages.
 */
export function createDocsActivitySource(sql: () => SqlExecutor | undefined): AiActivitySource {
  return {
    type: 'activity',
    async collect(writer, { userId, since }) {
      const db = sql();
      if (!db) return;
      const after = since.toISOString();
      const pages = await db<ChangedPage[]>`
        select p.id, p.title, p.status, p.space_id as "spaceId", s.ai_excluded as "spaceExcluded",
          (p.owner_id = ${userId}::uuid or p.created_by = ${userId}::uuid) as yours,
          (p.status = 'in_review' and ${userId}::uuid = any(p.reviewers)) as reviewer,
          (p.content_updated_at > ${after}::timestamptz) as edited,
          (select count(*)::int from page_comments c where c.page_id = p.id
            and c.deleted_at is null and c.created_at > ${after}::timestamptz) as comments,
          lc.author_id as "lastCommentAuthorId", lu.name as "lastCommentAuthor",
          lc.body_text as "lastComment"
        from pages p
        join spaces s on s.id = p.space_id
        left join lateral (select c.author_id, c.body_text from page_comments c
          where c.page_id = p.id and c.deleted_at is null and c.created_at > ${after}::timestamptz
          order by c.created_at desc limit 1) lc on true
        left join users lu on lu.id = lc.author_id
        where p.deleted_at is null and s.archived_at is null
          and p.space_id in (select space_id from space_members where user_id = ${userId}::uuid)
          and (p.content_updated_at > ${after}::timestamptz or lc.author_id is not null
            or lc.body_text is not null
            or (p.status = 'in_review' and ${userId}::uuid = any(p.reviewers)))
        order by (p.status = 'in_review' and ${userId}::uuid = any(p.reviewers)) desc,
          (p.owner_id = ${userId}::uuid) desc, p.updated_at desc
        limit ${DOCS_ACTIVITY_LIMIT}`;
      const shown = pages.filter(
        (page) => !page.spaceExcluded && !writer.excluded({ spaceId: page.spaceId }),
      );
      if (shown.length > 0) writer.heading('Pages that changed');
      for (const page of shown) {
        const facts = [
          `${page.title} (${page.status.replace('_', ' ')})`,
          page.reviewer ? 'your review is requested' : null,
          page.yours ? 'yours' : null,
          page.edited ? 'edited' : null,
          page.comments > 0 ? `${page.comments} new comments` : null,
        ];
        writer.cite({
          kind: 'page',
          objectId: page.id,
          label: page.title,
          href: pagePath(page.id),
          line: facts.filter(Boolean).join(' · '),
          body: page.lastComment
            ? `Latest comment by ${page.lastCommentAuthor ?? 'someone'}: ${page.lastComment}`
            : null,
          scope: { spaceId: page.spaceId, authorId: page.lastCommentAuthorId },
          counts: 'updates',
        });
      }
    },
  };
}
