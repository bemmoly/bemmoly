import type { SqlExecutor } from '@bemmoly/core';
import type { BoardConfig } from '../../../../shared/boards.ts';
import type { SchemeDiffEntry, SchemeKind } from '../../../../shared/schemes.ts';
import { projectStatuses } from '../boards/context.ts';
import { adoptConfig, defaultConfig } from '../boards/defaults.ts';
import { parseConfig, projectBoards } from '../boards/rows.ts';
import type { ProjectRow } from '../projects/rows.ts';
import { orgWorkflow, ownWorkflow } from '../workflow/project-copy.ts';
import { diffConfig, diffItems } from './diff.ts';
import {
  FIELD_ATTRIBUTES,
  fieldItems,
  TYPE_ATTRIBUTES,
  typeItems,
  WORKFLOW_ATTRIBUTES,
  workflowItems,
} from './items.ts';

/*
 * Where a project stands against the org default, per scheme kind. Issue
 * types and fields are overridden while the project's mark says so; a
 * workflow while the project has its own copy; a board, which every project
 * holds a copy of, while its mark is set or its settings differ.
 */

export interface SchemeState {
  originName: string;
  overridden: boolean;
  entries: SchemeDiffEntry[];
}

/** The board a project would have from the org default: its scheme matched by name, or one column per status. */
export async function inheritedBoardConfig(
  sql: SqlExecutor,
  projectId: string,
): Promise<{ name: string | null; config: BoardConfig }> {
  const [org] = await projectBoards(sql, null);
  const statuses = await projectStatuses(sql, projectId);
  const fallback = defaultConfig(statuses);
  if (!org) return { name: null, config: fallback };
  const orgConfig = parseConfig(org.config);
  const names = await sql<{ id: string; name: string }[]>`
    select id, name from workflow_statuses
    where id = any(${orgConfig.columns.flatMap((column) => column.statusIds)}::uuid[])`;
  const adopted = adoptConfig(orgConfig, new Map(names.map((row) => [row.id, row.name])), statuses);
  return { name: org.name, config: adopted ?? fallback };
}

async function boardState(sql: SqlExecutor, project: ProjectRow): Promise<SchemeState> {
  const [own] = await projectBoards(sql, project.id);
  const inherited = await inheritedBoardConfig(sql, project.id);
  const entries = own ? diffConfig(inherited.config, parseConfig(own.config)) : [];
  return {
    originName: inherited.name ?? 'Workspace board',
    overridden: Boolean(project.scheme_overrides.board) || entries.length > 0,
    entries,
  };
}

async function workflowState(sql: SqlExecutor, project: ProjectRow): Promise<SchemeState> {
  const origin = await orgWorkflow(sql);
  const own = await ownWorkflow(sql, project.id);
  if (!own) return { originName: origin.name, overridden: false, entries: [] };
  const entries = diffItems(
    await workflowItems(sql, origin.id),
    await workflowItems(sql, own.id),
    WORKFLOW_ATTRIBUTES,
  );
  return { originName: origin.name, overridden: true, entries };
}

export async function schemeState(
  sql: SqlExecutor,
  project: ProjectRow,
  kind: SchemeKind,
): Promise<SchemeState> {
  if (kind === 'board') return boardState(sql, project);
  if (kind === 'workflow') return workflowState(sql, project);
  const overridden = Boolean(project.scheme_overrides[kind]);
  const [load, attributes, originName] =
    kind === 'issue_types'
      ? [typeItems, TYPE_ATTRIBUTES, 'Workspace issue types']
      : [fieldItems, FIELD_ATTRIBUTES, 'Workspace fields'];
  if (!overridden) return { originName, overridden, entries: [] };
  const entries = diffItems(await load(sql, null), await load(sql, project.id), attributes);
  return { originName, overridden, entries };
}
