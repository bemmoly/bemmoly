import { describe, expect, it } from 'vitest';
import type { SqlClient } from '../../../clients/postgres.ts';
import { checkPostgres } from './checks.ts';
import {
  assertPostgresSupported,
  PostgresRequirementError,
  postgresRequirementProblem,
} from './postgres-requirement.ts';

/** A tagged-template stand-in that answers the one server query. */
function fakeSql(row: { num: string; vector: boolean; trgm: boolean }): SqlClient {
  return (async () => [row]) as unknown as SqlClient;
}

const URL = 'postgres://bemmoly:secret@db.internal:5432/bemmoly_db';

describe('postgresRequirementProblem', () => {
  it('accepts Postgres 18 and later with pgvector and pg_trgm', () => {
    expect(postgresRequirementProblem({ major: 18, vector: true, trgm: true })).toBeNull();
    expect(postgresRequirementProblem({ major: 19, vector: true, trgm: true })).toBeNull();
  });

  it('refuses Postgres 17, naming the fix', () => {
    const problem = postgresRequirementProblem({ major: 17, vector: true, trgm: true });
    expect(problem?.message).toContain('Postgres 17 is too old');
    expect(problem?.message).toContain('Postgres 18');
    expect(problem?.fix).toContain('pgvector/pgvector:pg18');
  });

  it('refuses a server without pgvector', () => {
    const problem = postgresRequirementProblem({ major: 18, vector: false, trgm: true });
    expect(problem?.message).toContain('does not have pgvector');
    expect(problem?.fix).toContain('Install pgvector');
  });
});

describe('assertPostgresSupported', () => {
  it('throws before any changeset on Postgres 17', async () => {
    const sql = fakeSql({ num: '170004', vector: true, trgm: true });
    await expect(assertPostgresSupported(sql)).rejects.toBeInstanceOf(PostgresRequirementError);
    await expect(assertPostgresSupported(sql)).rejects.toThrow(/Fix: Upgrade to Postgres 18/);
  });

  it('throws without pgvector and passes on 18 with it', async () => {
    await expect(
      assertPostgresSupported(fakeSql({ num: '180001', vector: false, trgm: true })),
    ).rejects.toThrow(/pgvector/);
    await expect(
      assertPostgresSupported(fakeSql({ num: '180001', vector: true, trgm: true })),
    ).resolves.toEqual({ major: 18, vector: true, trgm: true });
  });
});

describe('checkPostgres (setup wizard and bemmoly doctor)', () => {
  it('fails on Postgres 17 instead of warning', async () => {
    const check = await checkPostgres(fakeSql({ num: '170004', vector: true, trgm: true }), URL);
    expect(check.status).toBe('fail');
    expect(check.name).toBe('Postgres 17');
    expect(check.fix?.label).toBe('Upgrade Postgres');
    expect(check.fix?.hint).toContain('Postgres 18');
  });

  it('fails without pgvector instead of warning', async () => {
    const check = await checkPostgres(fakeSql({ num: '180001', vector: false, trgm: true }), URL);
    expect(check.status).toBe('fail');
    expect(check.value).toContain('pgvector');
    expect(check.fix?.label).toBe('Install extensions');
  });

  it('is ok on Postgres 18 with pgvector', async () => {
    const check = await checkPostgres(fakeSql({ num: '180001', vector: true, trgm: true }), URL);
    expect(check).toMatchObject({ status: 'ok', name: 'Postgres 18', fix: null });
    expect(check.value).toMatch(/^db\.internal:5432 · \d+ ms$/);
  });
});
