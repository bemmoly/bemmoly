import {
  decodeCursor,
  toPage,
  type RequestContext,
  type SqlClient,
  type SqlFragment,
} from '@bemmoly/core';
import {
  parseLql,
  ProviderError,
  validateLql,
  ValidationError,
  type LqlError,
  type LqlFieldCatalog,
  type Query,
} from '@bemmoly/shared';
import type { IssueQueryParams, IssuesPage } from '../../../../shared/index.ts';
import { accessFilter, userIdOf } from './access.ts';
import { loadCatalog } from './catalog.ts';
import { compileQuery, compileWhere, type CompileCatalog, type Compiled } from './compile.ts';
import type { LqlEvaluator } from './contract.ts';
import { issueColumns, toIssue, type IssueRow } from './rows.ts';
import type { ValueContext } from './values.ts';

export type { LqlEvaluator } from './contract.ts';
export { catalogOf, loadCatalog } from './catalog.ts';
export { compileQuery, compileWhere, type CompileCatalog, type Compiled } from './compile.ts';

export interface LqlServiceDeps {
  database?: SqlClient;
  /** Overridable so relative dates are fixed in tests. */
  now?: () => Date;
}

/** Parse and validation problems travel as one ValidationError the filter bar can underline. */
export function parseOrReject(text: string, catalog: LqlFieldCatalog): Query {
  const parsed = parseLql(text);
  if (!parsed.ok) throw rejection([parsed.error]);
  const errors = validateLql(parsed.value, catalog);
  if (errors.length > 0) throw rejection(errors);
  return parsed.value;
}

function rejection(errors: LqlError[]): ValidationError {
  return new ValidationError(errors[0]?.message ?? 'The query is not valid', {
    details: { errors },
  });
}

/**
 * Compiles LQL to parameterised SQL over `issues` and runs it with the
 * actor's project access applied, as tech design §16 describes. Also the
 * `LqlEvaluator` the workflow and automation rules call.
 */
export function createLqlService(deps: LqlServiceDeps) {
  const db = (): SqlClient => {
    if (!deps.database) throw new ProviderError('The work module needs the database');
    return deps.database;
  };
  const valueContext = (sql: SqlClient, ctx: RequestContext): ValueContext => ({
    sql,
    actorUserId: userIdOf(ctx),
    now: deps.now ? deps.now() : new Date(),
  });

  async function compile(
    ctx: RequestContext,
    text: string,
    projectId: string | null,
  ): Promise<Compiled & { access: SqlFragment }> {
    const sql = db();
    const catalog = await loadCatalog(sql, projectId);
    const query = parseOrReject(text, catalog);
    return {
      ...compileQuery(sql, query, catalog, valueContext(sql, ctx)),
      access: (await accessFilter(sql, ctx)).fragment,
    };
  }

  const evaluator: LqlEvaluator = {
    where(ctx, query, catalog: CompileCatalog) {
      const sql = db();
      return compileWhere(sql, query, catalog, valueContext(sql, ctx));
    },
    async matches(ctx, issueId, text) {
      const sql = db();
      const [issue] = await sql<{ project_id: string }[]>`
        select project_id from issues where id = ${issueId}::uuid`;
      if (!issue) return false;
      const compiled = await compile(ctx, text, issue.project_id);
      const [row] = await sql<{ matches: boolean }[]>`
        select exists (select 1 from issues
          where issues.id = ${issueId}::uuid and ${compiled.where}) as matches`;
      return row?.matches ?? false;
    },
  };

  return {
    ...evaluator,
    compile,
    catalog: (projectId: string | null) => loadCatalog(db(), projectId),
    parse: parseOrReject,

    /**
     * One page of issues for a query. Paging is keyset on the sort tuple with
     * the id tiebreak, through the cursor row itself, which keeps it correct
     * for any ORDER BY whose directions agree.
     */
    async query(ctx: RequestContext, params: IssueQueryParams): Promise<IssuesPage> {
      const projectId = params.projectId ?? null;
      await ctx.authz.authorize(
        ctx.actor,
        'work.issue.view',
        projectId
          ? { kind: 'project', id: projectId, moduleId: 'work' }
          : { kind: 'module', moduleId: 'work' },
      );
      const sql = db();
      const compiled = await compile(ctx, params.lql, projectId);
      const cursor = decodeCursor(params.cursor);
      const keys = compiled.sortKeys.reduce((acc, key) => sql`${acc}, ${key}`);
      const rows = await sql<IssueRow[]>`
        select ${issueColumns(sql)} from issues
        where issues.deleted_at is null
          and ${compiled.access}
          and (${projectId}::uuid is null or issues.project_id = ${projectId}::uuid)
          and ${compiled.where}
          ${cursor ? continuation(sql, keys, compiled, cursor) : sql``}
        order by ${compiled.orderBy}
        limit ${params.limit + 1}`;
      const page = toPage(rows, params.limit);
      return { items: page.rows.map(toIssue), nextCursor: page.nextCursor };
    },
  };
}

function continuation(
  sql: SqlClient,
  keys: SqlFragment,
  compiled: Compiled,
  cursor: string,
): SqlFragment {
  const [first] = compiled.directions;
  if (!compiled.directions.every((direction) => direction === first)) {
    throw new ValidationError('A query sorted in mixed directions cannot be paged', {
      code: 'bad_request',
    });
  }
  const row = sql`(select ${keys} from issues where issues.id = ${cursor}::uuid)`;
  return first === 'DESC' ? sql`and (${keys}) < ${row}` : sql`and (${keys}) > ${row}`;
}

export type LqlService = ReturnType<typeof createLqlService>;
