import {
  createMappingStore,
  type AuditRecorder,
  type ImportRunContext,
  type RequestContext,
  type SqlClient,
} from '@bemmoly/core';
import { plainText } from '@bemmoly/editor/convert';
import { ProviderError } from '@bemmoly/shared';
import {
  importIssuesBodySchema,
  type ImportedIssue,
  type ImportIssuesBody,
  type ImportIssuesResult,
} from '../../../../../shared/issue-import.ts';
import { actorUserId, projectResource } from '../../issues/deps.ts';
import { writeIssues, writeLabels, type ImportedIssueRow } from '../writer.ts';
import {
  markdownDocument,
  writeImportedComments,
  writeImportedParents,
  writeImportedTimes,
  type WrittenImport,
} from './extras.ts';
import { loadLookups, loadProject, reserveNumbers, type ImportLookups } from './resolve.ts';

/*
 * Issues an agent brings from another tracker, through the importers' writer and mapping
 * table so a batch sent twice updates instead of duplicating. Mappings are kept per project
 * under the source "mcp": an external key means one issue in one project. Writing as other
 * people and in the past is an import, so it takes the import capability on top of editing
 * the project's issues.
 */

export interface IssueImportDeps {
  database?: SqlClient;
  audit?: AuditRecorder;
}

const SOURCE = 'mcp';
const WORKSPACE = { kind: 'workspace' } as const;
const IMPORT_CAPABILITY = 'workspace.settings.manage';

function requireSql(deps: IssueImportDeps): SqlClient {
  if (!deps.database) throw new ProviderError('The work module needs the database');
  return deps.database;
}

function toRow(
  issue: ImportedIssue,
  project: { id: string; key: string },
  number: number,
  lookups: ImportLookups,
  callerId: string | null,
): ImportedIssueRow | string {
  const typeId = lookups.type(issue.type);
  if (!typeId) return `There is no issue type ${issue.type} in ${project.key}`;
  const status = lookups.status(issue.status);
  if (!status) return `There is no status ${issue.status} in the project's workflow`;
  const description = issue.descriptionMarkdown?.trim()
    ? markdownDocument(issue.descriptionMarkdown)
    : null;
  return {
    sourceId: issue.externalKey,
    label: issue.externalKey,
    number,
    key: `${project.key}-${number}`,
    typeId,
    title: issue.title,
    description,
    descriptionText: description ? plainText(description) : '',
    statusId: status.id,
    category: status.category,
    priority: issue.priority ?? 'medium',
    assigneeId: issue.assigneeEmail ? (lookups.users.get(issue.assigneeEmail) ?? null) : null,
    reporterId: (issue.reporterEmail && lookups.users.get(issue.reporterEmail)) || callerId,
    sprintId: null,
    estimate: null,
    dueAt: null,
    fixVersionId: null,
    componentId: null,
    customFields: {},
    createdAt: issue.createdAt ?? null,
    resolvedAt: issue.resolvedAt ?? issue.updatedAt ?? null,
    meta: {
      key: `${project.key}-${number}`,
      projectId: project.id,
      parent: issue.parentExternalKey ?? null,
    },
  };
}

export function createIssueImportService(deps: IssueImportDeps) {
  async function authorize(ctx: RequestContext, projectKey: string) {
    const project = await loadProject(requireSql(deps), projectKey);
    await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(project.id));
    await ctx.authz.authorize(ctx.actor, IMPORT_CAPABILITY, WORKSPACE);
    return project;
  }

  return {
    authorize: async (ctx: RequestContext, projectKey: string) => {
      await authorize(ctx, projectKey);
    },

    async run(ctx: RequestContext, input: ImportIssuesBody): Promise<ImportIssuesResult> {
      const body = importIssuesBodySchema.parse(input);
      const sql = requireSql(deps);
      const project = await authorize(ctx, body.projectKey);
      const callerId = actorUserId(ctx);
      const result: ImportIssuesResult = { created: [], updated: [], skipped: [], warnings: [] };
      const warn = (externalKey: string, message: string) =>
        result.warnings.push({ externalKey, message });
      const seen = new Set<string>();
      const issues = body.issues.filter((issue) => {
        if (!seen.has(issue.externalKey)) return seen.add(issue.externalKey);
        result.skipped.push({ externalKey: issue.externalKey, reason: 'Sent twice in the batch' });
        return false;
      });
      const mappings = createMappingStore(sql, { source: SOURCE, site: project.id, jobId: null });
      const lookups = await loadLookups(sql, project.id, issues);
      const known = await mappings.getMany(
        'issue',
        issues.map((issue) => issue.externalKey),
      );
      const ids = [...known.values()].map((mapped) => mapped.targetId);
      const existing = await sql<{ id: string; number: number }[]>`
        select id, number from issues where id = any(${ids}::uuid[]) and deleted_at is null`;
      const numberOf = new Map(existing.map((row) => [row.id, row.number]));
      const fresh = issues.filter((issue) => {
        const mapped = known.get(issue.externalKey);
        return !mapped || !numberOf.has(mapped.targetId);
      });

      const rows: ImportedIssueRow[] = [];
      const numbers = await reserveNumbers(
        sql,
        project.id,
        fresh
          .filter((issue) => lookups.type(issue.type) && lookups.status(issue.status))
          .map((issue) => issue.externalKey),
      );
      for (const issue of issues) {
        const mapped = known.get(issue.externalKey);
        const number =
          (mapped ? numberOf.get(mapped.targetId) : undefined) ?? numbers.get(issue.externalKey);
        const row = toRow(issue, project, number ?? 0, lookups, callerId);
        if (typeof row === 'string') {
          result.skipped.push({ externalKey: issue.externalKey, reason: row });
          continue;
        }
        if (issue.assigneeEmail && !row.assigneeId)
          warn(issue.externalKey, `No one here has the address ${issue.assigneeEmail}`);
        rows.push(row);
      }

      const skippedByWriter = new Map<string, string>();
      const report: ImportRunContext['report'] = {
        count: () => undefined,
        skip: (_kind, source, reason) => skippedByWriter.set(source, reason),
        warn: () => undefined,
      };
      const written = await writeIssues(sql, project.id, rows, mappings, report);
      const byKey = new Map(rows.map((row) => [row.sourceId, row]));
      const issueByKey = new Map(issues.map((issue) => [issue.externalKey, issue]));
      const done: (WrittenImport & { created: boolean })[] = [];
      for (const item of written) {
        const reason = skippedByWriter.get(item.sourceId);
        if (reason) {
          result.skipped.push({ externalKey: item.sourceId, reason });
          continue;
        }
        done.push({
          issue: issueByKey.get(item.sourceId) as ImportedIssue,
          id: item.id,
          created: item.created,
        });
      }
      for (const [externalKey, reason] of skippedByWriter) {
        if (!written.some((item) => item.sourceId === externalKey))
          result.skipped.push({ externalKey, reason });
      }

      const labels = new Map(
        done
          .filter((item) => item.issue.labels !== undefined)
          .map((item) => [item.id, item.issue.labels ?? []] as const),
      );
      await writeLabels(sql, project.id, labels);
      await writeImportedComments(sql, done, mappings, lookups.users, callerId);
      await writeImportedParents(sql, done, mappings, warn);
      const stamps = await writeImportedTimes(sql, done);
      await mappings.setMany(
        'issue',
        done.map((item) => ({
          sourceId: item.issue.externalKey,
          targetId: item.id,
          meta: {
            ...byKey.get(item.issue.externalKey)?.meta,
            syncedAt: stamps.get(item.id) ?? Date.now(),
          },
        })),
      );
      for (const item of done) {
        const key = byKey.get(item.issue.externalKey)?.key ?? '';
        (item.created ? result.created : result.updated).push({
          externalKey: item.issue.externalKey,
          key,
          id: item.id,
        });
      }
      await deps.audit?.record({
        actor: ctx.actor,
        action: 'work.issues.imported',
        target: { kind: 'project', id: project.id },
        after: {
          source: SOURCE,
          created: result.created.length,
          updated: result.updated.length,
          skipped: result.skipped.length,
        },
      });
      return result;
    },
  };
}

export type IssueImportService = ReturnType<typeof createIssueImportService>;
