import { describe, expect, it } from 'vitest';
import { suggestKey, validateSpace } from './use-create-space.ts';

describe('the create-space form', () => {
  it('suggests a key from the name', () => {
    expect(suggestKey('Engineering')).toBe('ENG');
    expect(suggestKey('Platform Core')).toBe('PC');
    expect(suggestKey('Company handbook')).toBe('CH');
    expect(suggestKey('2026 planning')).toBe('P');
    expect(suggestKey('')).toBe('');
  });

  it('asks for a name and a key the server will take', () => {
    const draft = { name: '', key: 'E', description: '', tone: 'accent' as const };
    expect(Object.keys(validateSpace(draft))).toEqual(['name', 'key']);
    expect(validateSpace({ ...draft, name: 'Engineering', key: 'ENG' })).toEqual({});
  });
});
