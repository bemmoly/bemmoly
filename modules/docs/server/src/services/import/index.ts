import { defineImporter } from '@bemmoly/core';
import type { Actor, ContainerMemberships, SqlClient } from '@bemmoly/core';
import type { RichText } from '../../../../shared/common.ts';
import type { DocsServiceDeps } from '../common.ts';
import { CONFLUENCE_FIELDS, parseConfluenceConnection } from './connection.ts';
import { discoverConfluence, planConfluence } from './discover.ts';
import { runConfluence } from './run.ts';

export interface ConfluenceImporterDeps {
  database?: SqlClient;
  memberships?: ContainerMemberships;
  entities?: DocsServiceDeps['entities'];
  replaceContent?: (pageId: string, snapshot: RichText, actor: Actor) => Promise<void>;
}

function requireSql(deps: ConfluenceImporterDeps): SqlClient {
  if (!deps.database) throw new Error('The Confluence importer needs the database');
  return deps.database;
}

/** Confluence Cloud and Data Center into Docs: spaces, page trees, bodies and their comments. */
export function createConfluenceImporter(deps: ConfluenceImporterDeps) {
  return defineImporter({
    id: 'confluence',
    label: 'Confluence',
    description:
      'Spaces, page trees, pages, comments and attachments from Confluence Cloud or Data Center.',
    brings: ['Spaces', 'Page trees', 'Pages', 'Labels', 'Comments', 'Attachments'],
    fields: CONFLUENCE_FIELDS,
    siteOf: (connection) => parseConfluenceConnection(connection).baseUrl,
    discover: discoverConfluence,
    plan: (connection, containers, ctx) =>
      planConfluence(requireSql(deps), connection, containers, ctx),
    run: (connection, plan, ctx) =>
      runConfluence(
        {
          sql: requireSql(deps),
          ...(deps.memberships ? { memberships: deps.memberships } : {}),
          ...(deps.entities ? { entities: deps.entities } : {}),
          ...(deps.replaceContent ? { replaceContent: deps.replaceContent } : {}),
        },
        connection,
        plan,
        ctx,
      ),
  });
}
