import { defineImporter, type ContainerMemberships, type SqlClient } from '@bemmoly/core';
import { JIRA_FIELDS, parseJiraConnection } from './connection.ts';
import { countJira, discoverJira } from './discover.ts';
import { peopleOfJira } from './people.ts';
import { planJira } from './plan.ts';
import { projectKeyFrom } from './schema.ts';
import { runJira } from './run.ts';

export interface JiraImporterDeps {
  database?: SqlClient;
  memberships?: ContainerMemberships;
}

function requireSql(deps: JiraImporterDeps): SqlClient {
  if (!deps.database) throw new Error('The Jira importer needs the database');
  return deps.database;
}

/** What a Jira import can bring along with the issues; issues themselves always come. */
export const JIRA_OPTIONS = [
  { name: 'comments', label: 'Comments', description: 'With authors and dates', default: true },
  {
    name: 'attachments',
    label: 'Attachments',
    description: 'Stored in Bemmoly file storage',
    default: true,
  },
  {
    name: 'agile',
    label: 'Sprints and boards',
    description: 'Board columns become workflow states',
    default: true,
  },
  {
    name: 'links',
    label: 'Links between issues',
    description: 'Blocks, relates to, duplicates',
    default: true,
  },
] as const;

/** Jira Cloud and Data Center into Work: projects, configuration, issues and everything on them. */
export function createJiraImporter(deps: JiraImporterDeps) {
  return defineImporter({
    id: 'jira',
    label: 'Jira',
    description:
      'Projects, issues, comments, attachments, sprints and boards from Jira Cloud or Data Center.',
    brings: [
      'Projects',
      'Issue types and statuses',
      'Custom fields',
      'Boards and sprints',
      'Issues',
      'Comments',
      'Attachments',
      'Links',
    ],
    fields: JIRA_FIELDS,
    nouns: {
      container: 'project',
      containers: 'projects',
      records: 'issues',
      target: 'Work project',
    },
    siteOf: (connection) => parseJiraConnection(connection).baseUrl,
    discover: (connection, ctx) => discoverJira(requireSql(deps), connection, ctx),
    count: countJira,
    options: JIRA_OPTIONS,
    people: peopleOfJira,
    targets: {
      label: 'Work project',
      container: 'project',
      records: 'issues',
      keyFrom: projectKeyFrom,
      byKeys: (keys) =>
        requireSql(deps)<{ id: string; key: string; name: string }[]>`
          select id, key, name from projects where key = any(${keys as string[]}::text[])`,
      byIds: (ids) =>
        requireSql(deps)<{ id: string; key: string; name: string }[]>`
          select id, key, name from projects where id = any(${ids as string[]}::uuid[])`,
      search: (q, limit) =>
        requireSql(deps)<{ id: string; key: string; name: string }[]>`
          select id, key, name from projects
          where ${q} = '' or key ilike ${`%${q}%`} or name ilike ${`%${q}%`}
          order by lower(name), id limit ${limit}`,
    },
    plan: (connection, containers, ctx) => planJira(requireSql(deps), connection, containers, ctx),
    run: (connection, plan, ctx) =>
      runJira(
        { sql: requireSql(deps), ...(deps.memberships ? { memberships: deps.memberships } : {}) },
        connection,
        plan,
        ctx,
      ),
  });
}
