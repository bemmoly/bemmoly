import { describe, expect, it } from 'vitest';
import { collabUser } from './user.ts';

const priya = collabUser({ id: 'u-priya', name: 'Priya Nair', email: 'priya@acme.test' });

describe('collab user', () => {
  it('carries the name, initials and a theme colour from the avatar hue', () => {
    expect(priya).toMatchObject({ id: 'u-priya', name: 'Priya Nair', initials: 'PN' });
    expect(priya.color).toBe(`var(--${priya.hue}-fg)`);
    expect(collabUser({ id: 'u-priya', name: 'Priya Nair', email: 'x' }).hue).toBe(priya.hue);
  });

  it('falls back to the email when the name is blank', () => {
    expect(collabUser({ id: 'u-1', name: ' ', email: 'sam@acme.test' }).name).toBe(
      'sam@acme.test',
    );
  });
});
