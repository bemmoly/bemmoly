import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { DOMAIN_EVENT_KINDS } from '@bemmoly/shared';
import type { Issue } from '../../../../shared/issues.ts';
import type { HistoryChange } from '../history/index.ts';
import type { IssueServiceDeps } from './deps.ts';
import { issuePath } from './notify.ts';

/*
 * The domain events an issue change publishes, for outgoing webhooks and the automation
 * rules. They join the writer's transaction, so a rolled back change announces nothing, and
 * carry the actor as it is, so a rule can tell its own actions apart. Payloads travel over
 * NOTIFY: ids, names and short text, never a description.
 */

export interface IssueEventPayload {
  summary: string;
  url: string;
  issue: {
    id: string;
    key: string;
    title: string;
    projectId: string;
    statusId: string;
    priority: string;
    assigneeId: string | null;
    reporterId: string | null;
  };
  /** issue.updated: the fields that changed, as the history names them. */
  fields?: string[];
  /** issue.transitioned: the statuses by name. */
  fromStatus?: string;
  toStatus?: string;
  /** issue.commented: the comment and its first characters. */
  comment?: { id: string; excerpt: string };
}

type IssueEventKind =
  | typeof DOMAIN_EVENT_KINDS.issueCreated
  | typeof DOMAIN_EVENT_KINDS.issueUpdated
  | typeof DOMAIN_EVENT_KINDS.issueTransitioned
  | typeof DOMAIN_EVENT_KINDS.issueCommented;

const TITLE_CHARS = 200;

const short = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

function describe(kind: IssueEventKind, issue: Issue, extra: Partial<IssueEventPayload>): string {
  const name = `${issue.key} ${short(issue.title, TITLE_CHARS)}`;
  if (kind === DOMAIN_EVENT_KINDS.issueCreated) return `${name} was created`;
  if (kind === DOMAIN_EVENT_KINDS.issueTransitioned) return `${name} moved to ${extra.toStatus}`;
  if (kind === DOMAIN_EVENT_KINDS.issueCommented) return `New comment on ${name}`;
  return `${name} was updated`;
}

export async function publishIssueEvent(
  deps: Pick<IssueServiceDeps, 'events' | 'now'>,
  ctx: RequestContext,
  tx: SqlExecutor,
  kind: IssueEventKind,
  issue: Issue,
  extra: Pick<IssueEventPayload, 'fields' | 'fromStatus' | 'toStatus' | 'comment'> = {},
): Promise<void> {
  const payload: IssueEventPayload = {
    summary: describe(kind, issue, extra),
    url: issuePath(issue.key),
    issue: {
      id: issue.id,
      key: issue.key,
      title: short(issue.title, TITLE_CHARS),
      projectId: issue.projectId,
      statusId: issue.statusId,
      priority: issue.priority,
      assigneeId: issue.assigneeId,
      reporterId: issue.reporterId,
    },
    ...extra,
  };
  await deps.events.publish({
    kind,
    occurredAt: deps.now?.() ?? new Date(),
    actor: ctx.actor,
    entity: { kind: 'issue', id: issue.id },
    payload,
    transaction: tx,
  });
}

/** issue.updated for every change, and issue.transitioned too when the status moved. */
export async function publishIssueUpdate(
  deps: Pick<IssueServiceDeps, 'events' | 'now'>,
  ctx: RequestContext,
  tx: SqlExecutor,
  issue: Issue,
  changes: readonly HistoryChange[],
  statuses: { from: string; to: string } | null,
): Promise<void> {
  const fields = [...new Set(changes.map((change) => change.field))];
  await publishIssueEvent(deps, ctx, tx, DOMAIN_EVENT_KINDS.issueUpdated, issue, { fields });
  if (!statuses) return;
  await publishIssueEvent(deps, ctx, tx, DOMAIN_EVENT_KINDS.issueTransitioned, issue, {
    fromStatus: statuses.from,
    toStatus: statuses.to,
  });
}
