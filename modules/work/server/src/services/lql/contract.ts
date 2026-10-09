import type { RequestContext, SqlFragment } from '@bemmoly/core';
import type { LqlFieldCatalog, Query } from '@bemmoly/shared';

/**
 * What the workflow engine's `lql_query` rule and the automation conditions
 * need from the compiler: a yes or no for one issue, and the predicate itself
 * for services that embed it in their own statement. The workflow stream codes
 * against this shape; the lql service is its one implementation.
 */
export interface LqlEvaluator {
  matches(ctx: RequestContext, issueId: string, query: string): Promise<boolean>;
  where(ctx: RequestContext, query: Query, catalog: LqlFieldCatalog): SqlFragment;
}
