import {
  aiRefusal,
  createContextWriter,
  type AiTargetContextBuilder,
  type ContextWriter,
  type RequestContext,
  type SqlExecutor,
} from '@bemmoly/core';
import { spaceResource, type DocsServiceDeps } from '../common.ts';
import { pagePath } from '../palette/index.ts';
import {
  projectOf,
  readLinkedIssues,
  readOpenComments,
  readPage,
  readPagesLinking,
  statusOf,
  type PageFacts,
} from './page-rows.ts';
import { issueParagraphPairs, pageSections } from './sections.ts';

export const PAGE_CONTEXT_LIMITS = { comments: 20, backlinks: 8, chars: 18_000 } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Deps = Pick<DocsServiceDeps, 'database' | 'entities'>;

async function canViewPage(sql: SqlExecutor | undefined, ctx: RequestContext, id: string) {
  if (!sql || !UUID.test(id)) return false;
  const [row] = await sql<{ space_id: string }[]>`
    select space_id from pages where id = ${id} and deleted_at is null`;
  return row ? ctx.authz.can(ctx.actor, 'docs.page.view', spaceResource(row.space_id)) : false;
}

/** The page's own space excluded (by policy or by the space's own switch) refuses it. */
function openPage(writer: ContextWriter, page: PageFacts): void {
  if (page.spaceExcluded || writer.excluded({ spaceId: page.spaceId })) {
    throw aiRefusal('excluded');
  }
}

function writeBody(writer: ContextWriter, page: PageFacts): void {
  const scope = { spaceId: page.spaceId, authorId: page.authorId };
  writer.heading(`Page "${page.title}" (${page.status})`);
  for (const section of pageSections(page.snapshot)) {
    const name = section.heading ?? 'Introduction';
    writer.cite({
      kind: 'section',
      objectId: page.id,
      label: section.heading ?? page.title,
      location: section.heading,
      href: section.anchor ? `${pagePath(page.id)}#${section.anchor}` : pagePath(page.id),
      line: `Section "${name}"`,
      body: section.paragraphs.map((p) => `¶${p.index} ${p.text}`).join('\n'),
      scope,
      counts: 'sections',
    });
  }
}

/**
 * pageContext (tech design 11.3): the page's text by heading, the issues it embeds with
 * their live states, its open comments and the TL;DRs of pages that link it.
 */
export function createPageContextBuilder(deps: Deps): AiTargetContextBuilder {
  return {
    type: 'target',
    targetKind: 'page',
    canView: (ctx, id) => canViewPage(deps.database, ctx, id),
    async build(id, options) {
      const sql = deps.database;
      if (!sql) return null;
      const page = await readPage(sql, id);
      if (!page) return null;
      const writer = createContextWriter({
        policy: options.policy,
        maxChars: PAGE_CONTEXT_LIMITS.chars,
      });
      openPage(writer, page);
      writeBody(writer, page);

      const issues = await readLinkedIssues(sql, deps, page.id);
      if (issues.length > 0) writer.heading('Issues on the page');
      for (const issue of issues) {
        writer.cite({
          kind: 'issue',
          objectId: issue.id,
          label: issue.key ?? issue.title,
          location: statusOf(issue),
          href: issue.path,
          line: `${issue.key} · ${issue.title} · ${statusOf(issue)}`,
          scope: { projectId: projectOf(issue) },
          counts: 'issues',
        });
      }

      const comments = await readOpenComments(sql, page.id, PAGE_CONTEXT_LIMITS.comments);
      if (comments.length > 0) writer.heading('Open comments');
      for (const comment of comments) {
        writer.cite({
          kind: 'comment',
          objectId: comment.id,
          label: `${comment.author ?? 'A comment'}'s comment`,
          location: comment.quote,
          href: `${pagePath(page.id)}#comment-${comment.id}`,
          line: `${comment.author ?? 'Someone'} on ${comment.createdAt.slice(0, 10)}${
            comment.quote ? ` about "${comment.quote.slice(0, 80)}"` : ''
          }`,
          body: comment.body,
          scope: { spaceId: page.spaceId, authorId: comment.authorId },
          counts: 'comments',
        });
      }

      const backlinks = await readPagesLinking(
        sql,
        { kind: 'page', id: page.id },
        PAGE_CONTEXT_LIMITS.backlinks,
      );
      const shown = backlinks.filter((other) => !other.spaceExcluded);
      if (shown.length > 0) writer.heading('Pages that link here');
      for (const other of shown) {
        writer.cite({
          kind: 'page',
          objectId: other.id,
          label: other.title,
          location: 'TL;DR',
          href: pagePath(other.id),
          line: other.title,
          body: other.tldr,
          scope: { spaceId: other.spaceId, authorId: other.authorId },
          counts: 'docs',
        });
      }
      return writer.build({ spaceId: page.spaceId }, { title: page.title });
    },
  };
}

/**
 * The consistency check's context: each issue the page embeds or names, paired with the
 * paragraph around it and the issue's own fields and description (from Work, through the
 * related sources). Pages that name no issue build an empty context and cost no model call.
 */
export function createPagePairsBuilder(deps: Deps): AiTargetContextBuilder {
  return {
    type: 'target',
    targetKind: 'page',
    canView: (ctx, id) => canViewPage(deps.database, ctx, id),
    async build(id, options) {
      const sql = deps.database;
      if (!sql) return null;
      const page = await readPage(sql, id);
      if (!page) return null;
      const writer = createContextWriter({ policy: options.policy, maxChars: 16_000 });
      openPage(writer, page);
      const pairs = issueParagraphPairs(pageSections(page.snapshot));
      const keys = [...new Set(pairs.map((pair) => pair.key))].slice(0, 12);
      const issues = deps.entities?.resolveMany
        ? await deps.entities.resolveMany(
            'issue',
            keys.map((key) => ({ key })),
          )
        : [];
      const byKey = new Map(issues.map((issue) => [issue.key ?? '', issue]));
      for (const key of keys) {
        const issue = byKey.get(key);
        if (!issue || writer.excluded({ projectId: projectOf(issue) })) continue;
        writer.heading(`Issue ${key}`);
        await options.related?.(writer, { kind: 'issue', id: issue.id });
        for (const pair of pairs.filter((candidate) => candidate.key === key)) {
          writer.cite({
            kind: 'section',
            objectId: page.id,
            label: pair.section.heading ?? page.title,
            location: `${pair.section.heading ?? 'Introduction'}, paragraph ${pair.paragraph.index}`,
            href: pair.section.anchor
              ? `${pagePath(page.id)}#${pair.section.anchor}`
              : pagePath(page.id),
            line: `Page "${page.title}", section "${pair.section.heading ?? 'Introduction'}", paragraph ${pair.paragraph.index}`,
            body: pair.paragraph.text,
            scope: { spaceId: page.spaceId, authorId: page.authorId },
            counts: 'paragraphs',
          });
        }
      }
      return writer.build({ spaceId: page.spaceId }, { title: page.title });
    },
  };
}
