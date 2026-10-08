import type {
  JobRegistry,
  RequestContext,
  RealtimePublisher,
  SqlClient,
  SqlExecutor,
} from '@bemmoly/core';

/**
 * Evaluates an LQL query against one issue. The boards stream compiles LQL to
 * SQL; the request context carries the actor that access filters need.
 */
export interface LqlEvaluator {
  matches(ctx: RequestContext, issueId: string, query: string): Promise<boolean>;
}

/** What the conditions read about an issue, so a rule file never writes SQL. */
export interface IssueReads {
  openSubtasks(sql: SqlExecutor, issueId: string): Promise<number>;
  unresolvedLinkedIssues(sql: SqlExecutor, issueId: string): Promise<number>;
}

/** The columns a post-action may change; each write also appends a history row. */
export type PostActionField = 'assignee_id' | 'sprint_id' | 'resolved_at';

export interface IssueWrites {
  setField(
    sql: SqlExecutor,
    issueId: string,
    actorId: string | null,
    field: PostActionField,
    value: string | null,
  ): Promise<void>;
}

export interface WorkflowServiceDeps {
  database?: SqlClient;
  realtime?: RealtimePublisher;
  jobs?: JobRegistry;
  lql?: LqlEvaluator;
}
