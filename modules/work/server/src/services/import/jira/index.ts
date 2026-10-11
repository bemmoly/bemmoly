import { defineImporter, type ContainerMemberships, type SqlClient } from '@bemmoly/core';
import { JIRA_FIELDS, parseJiraConnection } from './connection.ts';
import { discoverJira } from './discover.ts';
import { planJira } from './plan.ts';
import { runJira } from './run.ts';

export interface JiraImporterDeps {
  database?: SqlClient;
  memberships?: ContainerMemberships;
}

function requireSql(deps: JiraImporterDeps): SqlClient {
  if (!deps.database) throw new Error('The Jira importer needs the database');
  return deps.database;
}

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
    siteOf: (connection) => parseJiraConnection(connection).baseUrl,
    discover: discoverJira,
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
