import type { Variable } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { nameOf, nameValid, rowsFor } from './rows.ts';

const dev = {
  id: '0199f0aa-0000-7000-8000-000000000001',
  key: 'dev',
  name: 'Dev',
  class: 'dev' as const,
};

const variable = (name: string, environment: typeof dev | null, value = 'x'): Variable => ({
  name,
  kind: 'plain',
  environment,
  value,
  version: 1,
  state: 'set',
  problem: null,
  location: null,
  updatedBy: null,
  updatedAt: '2026-10-29T10:00:00.000Z',
  resolved: [],
});

describe('the rows of one view', () => {
  const items = [
    variable('LOG_LEVEL', null, 'info'),
    variable('LOG_LEVEL', dev, 'debug'),
    variable('REGION', null),
  ];

  it('lists only the shared values for every environment', () => {
    expect(rowsFor(items, null).map((row) => [row.name, row.variable.value])).toEqual([
      ['LOG_LEVEL', 'info'],
      ['REGION', 'x'],
    ]);
  });

  it('puts an environment’s own value over the shared one, and marks what it inherits', () => {
    expect(
      rowsFor(items, 'dev').map((row) => [
        row.name,
        row.variable.value,
        row.inherited,
        row.overrides?.value ?? null,
      ]),
    ).toEqual([
      ['LOG_LEVEL', 'debug', false, 'info'],
      ['REGION', 'x', true, null],
    ]);
  });

  it('takes typed names as the server does', () => {
    expect(nameOf('database url')).toBe('DATABASE_URL');
    expect(nameValid('DATABASE_URL')).toBe(true);
    expect(nameValid('9LIVES')).toBe(false);
  });
});
