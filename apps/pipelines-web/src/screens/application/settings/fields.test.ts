import { describe, expect, it } from 'vitest';
import { bodyOf, draftOf } from './fields.ts';

describe('the deploy settings form', () => {
  it('starts from what Pipelines holds, every other field empty', () => {
    const draft = draftOf({ scaling: { min: 2 }, healthcheck: { ready: '/ready' } });
    expect(draft['scaling.min']).toBe('2');
    expect(draft['healthcheck.ready']).toBe('/ready');
    expect(draft['scaling.max']).toBe('');
  });

  it('sends only the fields filled in, numbers as numbers', () => {
    const draft = { ...draftOf({}), 'scaling.max': ' 8 ', port: '3000', secretsAs: 'files' };
    expect(bodyOf(draft)).toEqual({
      ok: true,
      body: { scaling: { max: 8 }, port: 3000, secretsAs: 'files' },
    });
  });

  it('names the first field that does not parse', () => {
    expect(bodyOf({ ...draftOf({}), 'scaling.min': 'two' })).toEqual({
      ok: false,
      field: 'scaling.min',
    });
    expect(bodyOf({ ...draftOf({}), 'healthcheck.path': 'healthz' })).toEqual({
      ok: false,
      field: 'healthcheck.path',
    });
  });
});
