import type { SqlClient } from '../../../clients/postgres.ts';

/** Changesets default ids to uuidv7() (Postgres 18) and create the pgvector extension. */
export const MIN_POSTGRES_MAJOR = 18;

export interface PostgresServerInfo {
  major: number;
  /** pgvector is installed on the server (pg_available_extensions has `vector`). */
  vector: boolean;
  trgm: boolean;
}

export interface PostgresRequirementProblem {
  /** One line naming what is wrong, e.g. "Postgres 17 is too old; Bemmoly needs Postgres 18". */
  message: string;
  /** What to do about it. */
  fix: string;
}

export async function readPostgresServer(sql: SqlClient): Promise<PostgresServerInfo> {
  const [row] = await sql<{ num: string; vector: boolean; trgm: boolean }[]>`
    select current_setting('server_version_num') as num,
      exists(select 1 from pg_available_extensions where name = 'vector') as vector,
      exists(select 1 from pg_available_extensions where name = 'pg_trgm') as trgm`;
  return {
    major: Math.floor(Number(row?.num ?? 0) / 10_000),
    vector: row?.vector ?? false,
    trgm: row?.trgm ?? false,
  };
}

/** Why this server cannot run Bemmoly's schema, or null when it can. */
export function postgresRequirementProblem(
  info: PostgresServerInfo,
): PostgresRequirementProblem | null {
  if (info.major < MIN_POSTGRES_MAJOR) {
    return {
      message: `Postgres ${info.major} is too old; Bemmoly needs Postgres ${MIN_POSTGRES_MAJOR} or later with pgvector`,
      fix: `Upgrade to Postgres ${MIN_POSTGRES_MAJOR} with pgvector (the pgvector/pgvector:pg18 image), or install without --database-url to use the bundled database.`,
    };
  }
  const missing = [info.vector ? null : 'pgvector', info.trgm ? null : 'pg_trgm'].filter(
    (name): name is string => name !== null,
  );
  if (missing.length > 0) {
    return {
      message: `Postgres ${info.major} does not have ${missing.join(' or ')} installed; Bemmoly needs both`,
      fix: `Install ${missing.join(' and ')} on the database server (pgvector ships in the pgvector/pgvector:pg18 image), then start Bemmoly again.`,
    };
  }
  return null;
}

export class PostgresRequirementError extends Error {
  readonly fix: string;
  constructor(problem: PostgresRequirementProblem) {
    super(`${problem.message}. Fix: ${problem.fix}`);
    this.name = 'PostgresRequirementError';
    this.fix = problem.fix;
  }
}

/** Fails before any changeset runs, instead of halfway through one. */
export async function assertPostgresSupported(sql: SqlClient): Promise<PostgresServerInfo> {
  const info = await readPostgresServer(sql);
  const problem = postgresRequirementProblem(info);
  if (problem) throw new PostgresRequirementError(problem);
  return info;
}
