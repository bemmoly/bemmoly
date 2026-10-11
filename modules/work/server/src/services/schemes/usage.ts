import type { SqlExecutor } from '@bemmoly/core';
import { SCHEME_KINDS, type SchemeKind, type SchemeUsage } from '../../../../shared/schemes.ts';
import { projectBoards } from '../boards/rows.ts';
import { PROJECT_COLUMNS, type ProjectRow } from '../projects/rows.ts';
import { orgWorkflow, ownWorkflow } from '../workflow/project-copy.ts';
import { schemeState } from './compare.ts';

/*
 * Which active projects follow each org default and which run their own version, for the
 * org settings pages. Issue types and fields are the project's own once marked, a workflow
 * once the project holds a copy, a board once marked or changed (the board's diff decides).
 */

async function overrides(sql: SqlExecutor, project: ProjectRow, kind: SchemeKind) {
  if (kind === 'workflow') return Boolean(await ownWorkflow(sql, project.id));
  if (kind === 'board') return (await schemeState(sql, project, 'board')).overridden;
  return Boolean(project.scheme_overrides[kind]);
}

async function originName(sql: SqlExecutor, kind: SchemeKind): Promise<string> {
  if (kind === 'issue_types') return 'Workspace issue types';
  if (kind === 'fields') return 'Workspace fields';
  if (kind === 'workflow') return (await orgWorkflow(sql)).name;
  const [board] = await projectBoards(sql, null);
  return board?.name ?? 'Workspace board';
}

export async function schemeUsages(sql: SqlExecutor): Promise<SchemeUsage[]> {
  const projects = await sql<ProjectRow[]>`
    select ${sql.unsafe(PROJECT_COLUMNS)} from projects
    where archived_at is null order by key`;
  const items: SchemeUsage[] = [];
  for (const kind of SCHEME_KINDS) {
    const overriders = [];
    for (const project of projects) {
      if (await overrides(sql, project, kind)) {
        overriders.push({ id: project.id, key: project.key, name: project.name });
      }
    }
    items.push({
      kind,
      originName: await originName(sql, kind),
      projects: projects.length,
      overriders,
    });
  }
  return items;
}
