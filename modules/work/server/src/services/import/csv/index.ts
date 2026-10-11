import { defineImporter, type ContainerMemberships, type SqlClient } from '@bemmoly/core';
import { ValidationError, type ImportField } from '@bemmoly/shared';
import { columnMappings } from './columns.ts';
import { parseCsv } from './parse.ts';
import { csvProjectKey, runCsv } from './run.ts';

export interface CsvImporterDeps {
  database?: SqlClient;
  memberships?: ContainerMemberships;
}

const FIELDS: readonly ImportField[] = [
  {
    name: 'file',
    label: 'CSV file',
    kind: 'file',
    required: true,
    help: 'One issue per row with a header row. Exports from most trackers work as they are.',
  },
  {
    name: 'project',
    label: 'Project key',
    kind: 'text',
    required: true,
    placeholder: 'OPS',
    help: 'Issues go into this project; it is created when it does not exist.',
  },
  { name: 'projectName', label: 'Project name', kind: 'text', required: false },
];

const PROJECT_KEY = /^[A-Z][A-Z0-9]{1,9}$/;

function requireSql(deps: CsvImporterDeps): SqlClient {
  if (!deps.database) throw new Error('The CSV importer needs the database');
  return deps.database;
}

/** Issues from any CSV export into one Work project, columns matched by header. */
export function createCsvImporter(deps: CsvImporterDeps) {
  return defineImporter({
    id: 'csv',
    label: 'CSV',
    description: 'Issues from a CSV file, such as an export from another tracker or a spreadsheet.',
    brings: ['Issues', 'Statuses', 'Labels', 'Parents'],
    fields: FIELDS,
    siteOf: (connection) => `project:${csvProjectKey(connection)}`,
    async discover(connection) {
      const key = csvProjectKey(connection);
      if (!PROJECT_KEY.test(key)) {
        throw new ValidationError(
          'The project key is 2 to 10 capital letters or digits, starting with a letter',
        );
      }
      const { headers, rows } = parseCsv(connection['file'] ?? '');
      const mapped = columnMappings(headers).filter((mapping) => mapping.action === 'match');
      if (!mapped.some((mapping) => mapping.target === 'title')) {
        throw new ValidationError('No column holds the issue title; name one Summary or Title');
      }
      return {
        site: key,
        containers: [
          {
            id: 'file',
            key,
            name: `${rows.length} rows into ${key}`,
            kind: 'file',
            count: rows.length,
          },
        ],
        counts: { issues: rows.length, columns: headers.length },
        warnings: [],
      };
    },
    async plan(connection) {
      const { headers, rows } = parseCsv(connection['file'] ?? '');
      const key = csvProjectKey(connection);
      const [existing] = await requireSql(deps)<
        { id: string }[]
      >`select id from projects where key = ${key}`;
      return {
        containers: ['file'],
        counts: { issues: rows.length },
        mappings: [
          {
            kind: 'project',
            source: key,
            action: existing ? 'match' : 'create',
            target: key,
            note: existing ? 'A project with this key exists' : null,
          },
          ...columnMappings(headers),
        ],
      };
    },
    run: (connection, _plan, ctx) =>
      runCsv(
        { sql: requireSql(deps), ...(deps.memberships ? { memberships: deps.memberships } : {}) },
        connection,
        ctx,
      ),
  });
}
