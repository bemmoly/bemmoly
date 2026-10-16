import type { SqlClient } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { NamedScope } from '../../../../shared/access.ts';
import type { ScopeRef } from '../../../../shared/common.ts';
import { resolveTarget } from './facts.ts';
import type { AccessTarget, ScopeNode } from './types.ts';

/*
 * Scopes as the Access screen addresses them: "" (the organisation), "commerce",
 * "commerce/checkout", or an application by key; and as screens name them, with the path.
 */

export async function pathOfScopePath(
  sql: SqlClient,
  scopePath: string | undefined,
  root: ScopeNode,
): Promise<ScopeNode[]> {
  const [domainKey, groupKey] = (scopePath ?? '').split('/').filter(Boolean);
  if (!domainKey) return [root];
  const [domain] = await sql<{ id: string; key: string; name: string }[]>`
    select id, key, name from pipeline_domains where key = ${domainKey}`;
  if (!domain) throw new NotFoundError(`No domain called "${domainKey}"`);
  const path: ScopeNode[] = [root, { kind: 'domain', ...domain }];
  if (!groupKey) return path;
  const [group] = await sql<{ id: string; key: string; name: string }[]>`
    select id, key, name from pipeline_groups where domain_id = ${domain.id}::uuid and key = ${groupKey}`;
  if (!group) throw new NotFoundError(`No group called "${groupKey}" in ${domain.name}`);
  return [...path, { kind: 'group', ...group }];
}

export async function pathOfScopeRef(
  sql: SqlClient,
  scope: ScopeRef,
  root: ScopeNode,
): Promise<ScopeNode[]> {
  const target: AccessTarget =
    scope.kind === 'application' && scope.id
      ? { application: scope.id }
      : { scope: { kind: scope.kind, ...(scope.id ? { id: scope.id } : {}) } };
  return (await resolveTarget(sql, target, root)).path;
}

/** The target an action on this scope is checked against. */
export function targetOfPath(path: readonly ScopeNode[]): AccessTarget {
  const node = path.at(-1);
  if (!node || node.kind === 'organisation' || !node.id) return {};
  if (node.kind === 'application') return { application: node.id };
  return { scope: { kind: node.kind, id: node.id } };
}

export function namedScope(node: ScopeNode, path: readonly ScopeNode[]): NamedScope {
  const index = path.findIndex((item) => item.kind === node.kind && item.id === node.id);
  const names = (index >= 0 ? path.slice(0, index + 1) : [node]).map((item) => item.name);
  return {
    kind: node.kind,
    ...(node.id ? { id: node.id } : {}),
    name: node.name,
    path: names,
  };
}
