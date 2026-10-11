import type { ImportRunContext } from '@bemmoly/core';
import { fromAdf, fromJiraWiki, plainText } from '@bemmoly/editor/convert';
import type { JiraIssue, JiraUser } from '../../../clients/jira.ts';
import type { ImportedIssueRow } from '../writer.ts';
import type { FieldMapper } from './fields.ts';
import type { ProjectSetup } from './project-setup.ts';

/*
 * One Jira issue as the row Work stores: its number kept from its key, its type, status,
 * people, sprint, version and component mapped, its description converted, and the facts the
 * links pass needs (parent, links) kept on the mapping.
 */

const PRIORITIES: Record<string, ImportedIssueRow['priority']> = {
  highest: 'highest',
  blocker: 'highest',
  critical: 'highest',
  high: 'high',
  major: 'high',
  medium: 'medium',
  normal: 'medium',
  low: 'low',
  minor: 'low',
  lowest: 'lowest',
  trivial: 'lowest',
};

export const personId = (user: JiraUser) => user.accountId ?? user.key ?? user.name ?? '';

export interface RowContext {
  setup: ProjectSetup;
  fields: FieldMapper;
  sprints: ReadonlyMap<string, string>;
  ctx: ImportRunContext;
  /** People matched so far, for mentions inside text: source id to user and name. */
  people: Map<string, { id: string; label: string }>;
  /** "https://acme.example.net", to recognise links to issues on the same site. */
  siteUrl: string;
  /** The source project key to the key it has here, for issue links in text. */
  projectKeys: ReadonlyMap<string, string>;
  cloud: boolean;
}

export async function matchPerson(
  rows: RowContext,
  user: JiraUser | null | undefined,
): Promise<string | null> {
  if (!user) return null;
  const sourceId = personId(user);
  if (!sourceId) return null;
  const cached = rows.people.get(sourceId);
  if (cached) return cached.id;
  const id = await rows.ctx.users.match({
    sourceId,
    email: user.emailAddress ?? null,
    name: user.displayName ?? user.name ?? '',
  });
  if (id) rows.people.set(sourceId, { id, label: user.displayName ?? user.name ?? '' });
  return id;
}

/** An issue key the source names, as the key it has here. */
export function localKey(rows: RowContext, key: string): string | null {
  const match = /^([A-Z][A-Z0-9_]+)-(\d+)$/.exec(key);
  if (!match) return null;
  const project = rows.projectKeys.get(match[1]!) ?? match[1]!;
  return `${project}-${match[2]}`;
}

export function convertText(rows: RowContext, body: unknown): ReturnType<typeof fromAdf> {
  const resolveUser = (id: string) => rows.people.get(id) ?? null;
  if (!rows.cloud || typeof body === 'string')
    return fromJiraWiki(typeof body === 'string' ? body : '', { resolveUser });
  return fromAdf(body, {
    resolveUser,
    resolveIssueKey: (url) => {
      if (!url.toLowerCase().startsWith(rows.siteUrl)) return null;
      const key = /\/browse\/([A-Z][A-Z0-9_]+-\d+)/.exec(url)?.[1];
      return key ? localKey(rows, key) : null;
    },
  });
}

/** The sprint an issue is in now: the active one, else the latest it was in. */
function sprintOf(rows: RowContext, issue: JiraIssue): string | null {
  for (const [fieldId, builtIn] of rows.fields.builtIns) {
    if (builtIn !== 'sprint') continue;
    const raw = issue.fields[fieldId];
    if (!Array.isArray(raw) || !raw.length) continue;
    const sprints = raw.map((item) => {
      if (item && typeof item === 'object') {
        const sprint = item as { id?: number; state?: string };
        return { id: String(sprint.id ?? ''), state: sprint.state ?? '' };
      }
      const text = String(item);
      return {
        id: /\bid=(\d+)/.exec(text)?.[1] ?? '',
        state: (/\bstate=(\w+)/.exec(text)?.[1] ?? '').toLowerCase(),
      };
    });
    const chosen = sprints.find((sprint) => sprint.state === 'active') ?? sprints.at(-1);
    return chosen ? (rows.sprints.get(chosen.id) ?? null) : null;
  }
  return null;
}

function builtInValue(rows: RowContext, issue: JiraIssue, wanted: 'estimate' | 'epic'): unknown {
  for (const [fieldId, builtIn] of rows.fields.builtIns) {
    if (
      builtIn === wanted &&
      issue.fields[fieldId] !== null &&
      issue.fields[fieldId] !== undefined
    ) {
      return issue.fields[fieldId];
    }
  }
  return null;
}

const day = (value: string | null | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
const instant = (value: string | null | undefined) => {
  if (!value) return null;
  const at = Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(at) ? null : new Date(at).toISOString();
};

export async function toIssueRow(
  rows: RowContext,
  issue: JiraIssue,
): Promise<ImportedIssueRow | null> {
  const { setup, ctx } = rows;
  const f = issue.fields;
  const number = Number(/-(\d+)$/.exec(issue.key)?.[1]);
  const typeId = f.issuetype ? setup.types.get(f.issuetype.id) : undefined;
  const status = f.status ? setup.statuses.get(f.status.id) : undefined;
  if (!Number.isInteger(number) || number < 1) {
    ctx.report.skip('issue', issue.key, 'The key has no number');
    return null;
  }
  if (!typeId || !status) {
    ctx.report.skip(
      'issue',
      issue.key,
      typeId
        ? `Status ${f.status?.name ?? ''} is not mapped`
        : `Issue type ${f.issuetype?.name ?? ''} is not mapped`,
    );
    return null;
  }
  const people = (user: JiraUser | null | undefined) => matchPerson(rows, user);
  const assigneeId = await people(f.assignee);
  const reporterId = await people(f.reporter);
  const description = f.description ? convertText(rows, f.description) : null;
  const estimate = Number(builtInValue(rows, issue, 'estimate'));
  const epic = builtInValue(rows, issue, 'epic');
  if ((f.fixVersions?.length ?? 0) > 1)
    ctx.report.warn('Issues with several fix versions keep the first one.');
  if ((f.components?.length ?? 0) > 1)
    ctx.report.warn('Issues with several components keep the first one.');
  return {
    sourceId: issue.id,
    label: issue.key,
    number,
    key: `${setup.key}-${number}`,
    typeId,
    title: (f.summary ?? '').trim() || issue.key,
    description,
    descriptionText: description ? plainText(description) : '',
    statusId: status.id,
    category: status.category,
    priority: PRIORITIES[(f.priority?.name ?? '').toLowerCase()] ?? 'medium',
    assigneeId,
    reporterId,
    sprintId: sprintOf(rows, issue),
    estimate: Number.isFinite(estimate) && estimate >= 0 ? estimate : null,
    dueAt: day(f.duedate),
    fixVersionId: f.fixVersions?.[0] ? (setup.versions.get(f.fixVersions[0].id) ?? null) : null,
    componentId: f.components?.[0] ? (setup.components.get(f.components[0].id) ?? null) : null,
    customFields: await rows.fields.valuesFor(f, people),
    createdAt: instant(f.created),
    resolvedAt: instant(f.resolutiondate),
    meta: {
      key: issue.key,
      projectId: setup.projectId,
      parent: f.parent?.id ?? null,
      epicKey: typeof epic === 'string' ? epic : null,
      links: (f.issuelinks ?? [])
        .filter((link) => link.outwardIssue)
        .map((link) => ({
          to: link.outwardIssue!.id,
          type: (link.type?.name ?? '').toLowerCase(),
        })),
    },
  };
}
