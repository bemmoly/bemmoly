import { describe, expect, it } from 'vitest';
import { createBodyOf, draftReady, keyOf, NEW_DRAFT } from './environment-draft.ts';

describe('the environment form', () => {
  it('starts with every setting off and takes the ID from the name until typed', () => {
    const draft = { ...NEW_DRAFT, name: 'QA east' };
    expect(keyOf(draft)).toBe('qa-east');
    expect(createBodyOf(draft)).toEqual({
      name: 'QA east',
      key: 'qa-east',
      deployers: null,
      window: null,
      versionsAllowed: 'any',
    });
  });

  it('refuses a window whose times are not times', () => {
    const draft = {
      ...NEW_DRAFT,
      name: 'QA',
      window: { days: 'weekdays' as const, from: '10', to: '18:00', timeZone: 'UTC' },
    };
    expect(draftReady(draft)).toBe(false);
  });
});
