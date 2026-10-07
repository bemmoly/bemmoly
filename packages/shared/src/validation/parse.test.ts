import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '../errors/errors.ts';
import { parseOrThrow } from './parse.ts';

const schema = z.object({ name: z.string().min(2), tags: z.array(z.string()) });

describe('parseOrThrow', () => {
  it('returns parsed data when valid', () => {
    expect(parseOrThrow(schema, { name: 'ab', tags: [] })).toEqual({ name: 'ab', tags: [] });
  });

  it('throws ValidationError with issue paths when invalid', () => {
    let thrown: unknown;
    try {
      parseOrThrow(schema, { name: 'a', tags: [1] });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    const details = (thrown as ValidationError).details as { issues: { path: string }[] };
    expect(details.issues.map((issue) => issue.path).sort()).toEqual(['name', 'tags.0']);
  });
});
