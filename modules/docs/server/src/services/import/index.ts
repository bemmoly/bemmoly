import { defineImporter } from '@bemmoly/core';
import type { Actor, ContainerMemberships, SqlClient } from '@bemmoly/core';
import type { RichText } from '../../../../shared/common.ts';
import type { DocsServiceDeps } from '../common.ts';
import { CONFLUENCE_FIELDS, parseConfluenceConnection, spaceKeyFrom } from './connection.ts';
import { peopleOfConfluence } from './people.ts';
import { countConfluence, discoverConfluence, planConfluence } from './discover.ts';
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

/** What a Confluence import can bring along with the pages; pages and trees always come. */
export const CONFLUENCE_OPTIONS = [
  {
    name: 'comments',
    label: 'Comments',
    description: 'Page and inline comments, with authors',
    default: true,
  },
  {
    name: 'attachments',
    label: 'Attachments',
    description: 'Stored in Bemmoly file storage',
    default: true,
  },
] as const;

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
    nouns: { container: 'space', containers: 'spaces', records: 'pages', target: 'Docs space' },
    discover: (connection, ctx) => discoverConfluence(requireSql(deps), connection, ctx),
    count: countConfluence,
    plan: async (_connection, containers) => planConfluence(containers),
    options: CONFLUENCE_OPTIONS,
    people: peopleOfConfluence,
    targets: {
      label: 'Docs space',
      container: 'space',
      records: 'pages',
      keyFrom: spaceKeyFrom,
      byKeys: (keys) =>
        requireSql(deps)<{ id: string; key: string; name: string }[]>`
          select id, key, name from spaces where key = any(${keys as string[]}::text[])`,
      byIds: (ids) =>
        requireSql(deps)<{ id: string; key: string; name: string }[]>`
          select id, key, name from spaces where id = any(${ids as string[]}::uuid[])`,
      search: (q, limit) =>
        requireSql(deps)<{ id: string; key: string; name: string }[]>`
          select id, key, name from spaces
          where ${q} = '' or key ilike ${`%${q}%`} or name ilike ${`%${q}%`}
          order by lower(name), id limit ${limit}`,
    },
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
