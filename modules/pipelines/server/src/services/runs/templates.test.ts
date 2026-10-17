import { describe, expect, it } from 'vitest';
import { asWritten, definitionOf, storable } from './templates.ts';

/** What a jsonb column hands back: every object's keys sorted, shorter keys first. */
function throughJsonb(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(throughJsonb);
  if (typeof value !== 'object' || value === null) return value;
  const keys = Object.keys(value).sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
  return Object.fromEntries(
    keys.map((key) => [key, throughJsonb((value as Record<string, unknown>)[key])]),
  );
}

describe('stored pipeline definitions', () => {
  const declared = {
    checkout: false,
    inputs: {
      suite: { type: 'choice', options: ['smoke', 'full'], default: 'smoke' },
      flaky: { type: 'boolean', default: true },
      region: { default: 'asia-south1' },
      at: { type: 'number', default: 1 },
    },
    test: [{ name: 'Unit', run: 'pnpm test' }],
  };

  it('keeps inputs in declared order through a jsonb round trip', () => {
    const stored = throughJsonb(JSON.parse(JSON.stringify(storable(declared))));
    expect(Object.keys(definitionOf(stored)?.inputs ?? {})).toEqual([
      'suite',
      'flaky',
      'region',
      'at',
    ]);
    expect(definitionOf(stored)?.inputs.suite).toMatchObject({ options: ['smoke', 'full'] });
  });

  it('keeps extends as written and reads rows stored before inputs were a list', () => {
    const extending = { extends: 'acme/node-service@3', inputs: { port: { default: '8080' } } };
    expect(storable(extending)).toEqual({
      extends: 'acme/node-service@3',
      inputs: [{ name: 'port', default: '8080' }],
    });
    expect(definitionOf(extending)).toMatchObject({
      extends: { ref: 'acme/node-service', version: 3 },
      inputs: { port: { default: '8080' } },
    });
    expect(asWritten(throughJsonb(declared))).toMatchObject({ inputs: { at: { default: 1 } } });
  });
});
