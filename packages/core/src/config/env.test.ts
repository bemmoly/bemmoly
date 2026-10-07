import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env.ts';

const SECRET = Buffer.alloc(32, 7).toString('base64');
const minimal = { BEMMOLY_SECRET_KEY: SECRET, BEMMOLY_PUBLIC_URL: 'http://localhost:8080' };

describe('parseEnv', () => {
  it('applies defaults from the configuration model', () => {
    const env = parseEnv(minimal);
    expect(env).toMatchObject({
      BEMMOLY_ROLE: 'all',
      BEMMOLY_MODULES: [],
      BEMMOLY_DATA_DIR: '/var/bemmoly/data',
      PORT: 8080,
      LOG_LEVEL: 'info',
      LOG_FORMAT: 'json',
      BEMMOLY_TRUST_PROXY: false,
      BEMMOLY_ALLOW_PRIVATE_URLS: false,
      BEMMOLY_DB_AUTO_MIGRATE: true,
    });
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it('leaves the release version unset unless one is named', () => {
    expect(parseEnv(minimal).BEMMOLY_VERSION).toBeUndefined();
    expect(parseEnv({ ...minimal, BEMMOLY_VERSION: '' }).BEMMOLY_VERSION).toBeUndefined();
    expect(parseEnv({ ...minimal, BEMMOLY_VERSION: ' 0.1.0 ' }).BEMMOLY_VERSION).toBe('0.1.0');
  });

  it('parses lists, booleans and numbers, treating empty values as unset', () => {
    const env = parseEnv({
      ...minimal,
      DATABASE_URL: 'postgres://bemmoly:pw@localhost:5432/bemmoly_db',
      BEMMOLY_MODULES: 'work, docs',
      BEMMOLY_TRUST_PROXY: 'true',
      BEMMOLY_DB_AUTO_MIGRATE: 'false',
      PORT: '9090',
      OTEL_EXPORTER_OTLP_ENDPOINT: '',
    });
    expect(env.BEMMOLY_MODULES).toEqual(['work', 'docs']);
    expect(env.BEMMOLY_TRUST_PROXY).toBe(true);
    expect(env.BEMMOLY_DB_AUTO_MIGRATE).toBe(false);
    expect(env.PORT).toBe(9090);
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  it('keeps /metrics off without a token and rejects a short one', () => {
    expect(parseEnv(minimal).BEMMOLY_METRICS_TOKEN).toBeUndefined();
    const token = 'a'.repeat(64);
    expect(parseEnv({ ...minimal, BEMMOLY_METRICS_TOKEN: token }).BEMMOLY_METRICS_TOKEN).toBe(
      token,
    );
    expect(() => parseEnv({ ...minimal, BEMMOLY_METRICS_TOKEN: 'short' })).toThrow(
      /BEMMOLY_METRICS_TOKEN/,
    );
  });

  it('fails fast naming every bad key without echoing values', () => {
    const bad = {
      BEMMOLY_SECRET_KEY: 'c2hvcnQ=',
      BEMMOLY_PUBLIC_URL: 'ftp://nope',
      LOG_LEVEL: 'loud',
      DATABASE_URL: 'mysql://x',
    };
    let error: unknown;
    try {
      parseEnv(bad);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(EnvError);
    const keys = (error as EnvError).problems.map((problem) => problem.split(':')[0]);
    expect(keys.sort()).toEqual([
      'BEMMOLY_PUBLIC_URL',
      'BEMMOLY_SECRET_KEY',
      'DATABASE_URL',
      'LOG_LEVEL',
    ]);
    expect((error as EnvError).message).not.toContain('c2hvcnQ=');
  });

  it('requires the secret key and public URL', () => {
    expect(() => parseEnv({})).toThrow(/BEMMOLY_SECRET_KEY/);
    expect(() => parseEnv({ BEMMOLY_SECRET_KEY: SECRET })).toThrow(/BEMMOLY_PUBLIC_URL/);
  });
});
