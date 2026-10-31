import type { SqlExecutor } from '@bemmoly/core';
import { isBemmolyError, ProviderError } from '@bemmoly/shared';
import { isMap, isSeq, parseDocument } from 'yaml';
import type { CatalogChange } from '../../../../shared/catalog-writes.ts';
import { REPOSITORY_FILE_PATH } from '../../../../shared/repository-yaml.ts';
import type { CatalogChangeRow } from '../../models/catalog-writes.ts';
import { iso } from '../../utils/time.ts';
import type { PullRequestOpener } from '../code/pull-requests.ts';
import type { RepositoryReader } from '../code/repository-reader.ts';

/*
 * A UI edit to an application whose truth is a file in its repository becomes a pull request
 * that edits the file, reviewed like code (architecture §9). The file is edited in place,
 * keeping comments and anything Pipelines does not manage (the pipeline section). When the
 * file cannot be read or the host cannot open a pull request, the change waits as pending
 * with the reason, and the application is unchanged until the file is.
 */

export interface RepositoryChangeInput {
  kind: 'create' | 'update' | 'archive';
  applicationId: string | null;
  applicationKey: string;
  repository: { id: string | null; fullName: string; defaultBranch: string };
  filePath: string;
  /** Fields as application.yaml names them; undefined leaves a field alone, null removes it. */
  fields: Record<string, unknown>;
  /** The whole file, for a create. */
  content?: string;
  summary: string;
  createdBy: string | null;
}

export interface ChangePorts {
  pullRequests: PullRequestOpener;
  repositories: RepositoryReader;
}

/** "Changes owner and tier". */
export function summarise(fields: readonly string[]): string {
  const names = fields.map((field) => (field === 'dependsOn' ? 'dependencies' : field));
  if (names.length === 0) return 'Changes nothing';
  if (names.length === 1) return `Changes ${names[0]}`;
  return `Changes ${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Applies `fields` to the file's text, keeping its comments and other keys. */
export function editFile(content: string, fields: Record<string, unknown>): string {
  const document = parseDocument(content);
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const empty = value === null || (Array.isArray(value) && value.length === 0);
    if (empty) document.delete(key);
    else document.set(key, value);
  }
  return document.toString({ lineWidth: 100 });
}

/**
 * Applies `fields` to one application's entry in the repository file's central list, or
 * null when the list has no entry with that name.
 */
export function editEntry(
  content: string,
  name: string,
  fields: Record<string, unknown>,
): string | null {
  const document = parseDocument(content);
  const list = document.get('applications');
  const entry = isSeq(list)
    ? list.items.find((item) => isMap(item) && item.get('name') === name)
    : undefined;
  if (!isMap(entry)) return null;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const empty = value === null || (Array.isArray(value) && value.length === 0);
    if (empty) entry.delete(key);
    else entry.set(key, document.createNode(value));
  }
  return document.toString({ lineWidth: 100 });
}

async function newContent(input: RepositoryChangeInput, ports: ChangePorts) {
  if (input.content !== undefined) return { content: input.content, reason: null };
  const tree = await ports.repositories
    .tree(input.repository.fullName, input.repository.defaultBranch)
    .catch(() => null);
  const current = tree ? await tree.read(input.filePath).catch(() => null) : null;
  if (current === null) {
    return {
      content: null,
      reason: `${input.filePath} could not be read from ${input.repository.fullName}`,
    };
  }
  if (input.filePath !== REPOSITORY_FILE_PATH) {
    return { content: editFile(current, input.fields), reason: null };
  }
  const edited = editEntry(current, input.applicationKey, input.fields);
  return edited === null
    ? { content: null, reason: `${input.applicationKey} is not in the list in ${input.filePath}` }
    : { content: edited, reason: null };
}

export async function openRepositoryChange(
  sql: SqlExecutor,
  ports: ChangePorts,
  input: RepositoryChangeInput,
): Promise<string> {
  const { content, reason: unreadable } = await newContent(input, ports);
  let url: string | null = null;
  let reason = unreadable;
  if (content !== null) {
    try {
      const opened = await ports.pullRequests.openPullRequest({
        repository: input.repository.fullName,
        baseBranch: input.repository.defaultBranch,
        branch: `bemmoly/catalog/${input.applicationKey}-${Date.now().toString(36)}`,
        title: `${input.kind === 'create' ? 'Add' : 'Update'} ${input.applicationKey} in the Pipelines catalog`,
        body: `${input.summary}.\n\nOpened from Bemmoly Pipelines. The catalog changes when this merges.`,
        files: [{ path: input.filePath, content }],
      });
      url = opened?.url ?? null;
      if (!url) reason = 'The code host is not connected for pull requests yet';
    } catch (error) {
      if (!(error instanceof ProviderError) && !isBemmolyError(error)) throw error;
      reason = `The code host could not open a pull request: ${error.message}`;
    }
  }
  const [row] = await sql<{ id: string }[]>`
    insert into pipeline_catalog_changes
      (application_id, repository_id, kind, state, summary, changes, file_path, file_content,
       pull_request_url, reason, created_by)
    values (${input.applicationId}::uuid, ${input.repository.id}::uuid, ${input.kind},
      ${url ? 'pull_request' : 'pending'}, ${input.summary}, ${JSON.stringify(input.fields)}::jsonb,
      ${input.filePath}, ${content}, ${url}, ${url ? null : reason}, ${input.createdBy}::uuid)
    returning id`;
  return row?.id ?? '';
}

export const CHANGE_SELECT = `
  c.id, c.application_id, a.key as application_key, a.name as application_name,
  r.full_name as repository_full_name, c.kind, c.state, c.summary, c.changes,
  c.pull_request_url, c.reason, c.created_by, u.name as created_by_name, c.created_at`;

export const CHANGE_FROM = `
  pipeline_catalog_changes c
  left join pipeline_applications a on a.id = c.application_id
  left join pipeline_repositories r on r.id = c.repository_id
  left join users u on u.id = c.created_by`;

export function toCatalogChange(row: CatalogChangeRow): CatalogChange {
  return {
    id: row.id,
    application:
      row.application_id && row.application_key
        ? { id: row.application_id, key: row.application_key, name: row.application_name ?? '' }
        : null,
    repository: row.repository_full_name,
    kind: row.kind,
    state: row.state,
    summary: row.summary,
    changes: row.changes,
    pullRequestUrl: row.pull_request_url,
    reason: row.reason,
    createdBy: row.created_by ? { id: row.created_by, name: row.created_by_name ?? '' } : null,
    createdAt: iso(row.created_at),
  };
}

export async function readChange(sql: SqlExecutor, id: string): Promise<CatalogChange> {
  const [row] = await sql<CatalogChangeRow[]>`
    select ${sql.unsafe(CHANGE_SELECT)} from ${sql.unsafe(CHANGE_FROM)} where c.id = ${id}::uuid`;
  if (!row) throw new ProviderError('The catalog change was not stored');
  return toCatalogChange(row);
}
