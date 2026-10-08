import type { JobRegistry, RealtimePublisher, SqlClient, SqlExecutor } from '@bemmoly/core';

/**
 * Evaluates an LQL query against one issue. The boards stream compiles LQL to
 * SQL; until it is wired in, the lql_query condition reports itself as not
 * available rather than silently passing.
 */
export interface LqlEvaluator {
  matches(sql: SqlExecutor, issueId: string, query: string): Promise<boolean>;
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
