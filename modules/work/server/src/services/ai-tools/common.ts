import type { RequestContext } from '@bemmoly/core';
import type { AiPlanStepPreview } from '@bemmoly/shared';
import { fromMarkdownBase } from '@bemmoly/editor/convert';
import type { RichText } from '../../../../shared/common.ts';
import type { IssueDetail } from '../../../../shared/issues.ts';
import { projectResource } from '../issues/deps.ts';
import type { WorkServices } from '../index.ts';

/** Where an issue opens: the peek over the board, as the palette opens it. */
export const issueHref = (key: string) => `/work/issue/${key}`;

/** "PLT" of "PLT-204": project-scoped endpoints take the project key. */
export const projectKeyOf = (issue: Pick<IssueDetail, 'key'>) => issue.key.split('-')[0] ?? '';

/** The issue as the person sees it, and the edit check every field change makes. */
export async function editableIssue(
  services: WorkServices,
  ctx: RequestContext,
  key: string,
): Promise<IssueDetail> {
  const issue = await services.issues.get(ctx, key);
  await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(issue.projectId));
  return issue;
}

/** One field of one issue going from one value to another. */
export function fieldPreview(
  issue: Pick<IssueDetail, 'key' | 'title'>,
  from: string,
  to: string,
): AiPlanStepPreview {
  return {
    target: issue.key,
    change: issue.title.slice(0, 2000),
    field: null,
    from: from.slice(0, 200),
    to: to.slice(0, 200),
    href: issueHref(issue.key),
  };
}

/** An AI's words, which are Markdown, as the editor's document. */
export function textDocument(text: string): RichText {
  return fromMarkdownBase(text) as RichText;
}

export const priorityName = (priority: string) =>
  priority.charAt(0).toUpperCase() + priority.slice(1);
