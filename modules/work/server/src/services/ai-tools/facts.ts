import type { RequestContext } from '@bemmoly/core';
import { toMarkdown } from '@bemmoly/editor/convert';
import type { Issue } from '../../../../shared/issues.ts';
import type { WorkServices } from '../index.ts';

/*
 * What the read tools add beside ids: a description a client can read, the names of types and
 * parents, and the fields each issue type takes, so a client creating issues sends them right
 * the first time.
 */

/** Enough of a description to act on; work_get_issue's issue has the rest. */
const DESCRIPTION_PREVIEW = 4000;

type Readable = Parameters<typeof toMarkdown>[0];

/** A description as Markdown, cut at the preview length with a flag saying so. */
export function descriptionOf(issue: Pick<Issue, 'description' | 'descriptionText'>) {
  const markdown = issue.description
    ? toMarkdown(issue.description as Readable)
    : issue.descriptionText;
  const truncated = markdown.length > DESCRIPTION_PREVIEW;
  return {
    description: truncated ? markdown.slice(0, DESCRIPTION_PREVIEW) : markdown,
    descriptionTruncated: truncated,
  };
}

/** Type names and parent keys for a page of issues, read once per project and per parent. */
export async function namesFor(
  services: WorkServices,
  ctx: RequestContext,
  issues: readonly Issue[],
) {
  const typeNames = new Map<string, string>();
  for (const key of new Set(issues.map((issue) => issue.key.split('-')[0] ?? ''))) {
    for (const type of (await services.types.list(ctx, key)).items) {
      typeNames.set(type.id, type.name);
    }
  }
  const parentKeys = new Map(issues.map((issue) => [issue.id, issue.key]));
  for (const issue of issues) {
    if (!issue.parentId || parentKeys.has(issue.parentId)) continue;
    // The list carries only the parent's id; the issue page names it, one read per parent.
    const parent = (await services.issues.get(ctx, issue.key)).parent;
    if (parent) parentKeys.set(parent.id, parent.key);
  }
  return {
    type: (issue: Issue) => typeNames.get(issue.typeId) ?? null,
    parentKey: (issue: Issue) => (issue.parentId ? (parentKeys.get(issue.parentId) ?? null) : null),
  };
}

/** A project's issue types, each with the fields its create form takes and which are required. */
export async function typesWithFields(
  services: WorkServices,
  ctx: RequestContext,
  projectKey: string,
) {
  const [types, fields] = await Promise.all([
    services.types.list(ctx, projectKey),
    services.fields.list(ctx, projectKey),
  ]);
  const byId = new Map(fields.items.map((field) => [field.id, field]));
  return Promise.all(
    types.items.map(async (type) => {
      const layout = (await services.types.layout(ctx, projectKey, type.id)).items;
      return {
        id: type.id,
        name: type.name,
        fields: layout.flatMap((row) => {
          const field = byId.get(row.fieldId);
          if (!field) return [];
          return [
            {
              key: field.key,
              name: field.name,
              type: field.kind,
              required: row.required,
              options: field.options.map((option) => option.value),
            },
          ];
        }),
      };
    }),
  );
}
