import { describe, expect, it } from 'vitest';
import { collabStatusLine } from '../page/page-body.tsx';
import type { CollabState } from './session.ts';
import { collabUser } from './user.ts';

const priya = collabUser({ id: 'u-priya', name: 'Priya Nair', email: 'priya@acme.test' });
const state = (patch: Partial<CollabState>): CollabState => ({
  status: 'live',
  editable: true,
  unsynced: 0,
  peers: [],
  ...patch,
});

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

describe('collab status line', () => {
  it('reads as the mock header does, with who else is editing', () => {
    expect(collabStatusLine(state({ peers: [priya] }))).toBe('Saved · Priya Nair is editing');
    expect(collabStatusLine(state({ unsynced: 2, peers: [priya, priya] }))).toBe(
      'Saving… · 2 people editing',
    );
  });

  it('names every other state', () => {
    expect(collabStatusLine(state({ status: 'connecting' }))).toBe('Connecting…');
    expect(collabStatusLine(state({ status: 'offline' }))).toMatch(/^Offline/);
    expect(collabStatusLine(state({ status: 'read-only' }))).toBe('Read only');
    expect(collabStatusLine(state({ status: 'denied' }))).toMatch(/do not have access/);
    expect(collabStatusLine(state({ status: 'local' }))).toMatch(/changes stay in this tab/);
  });
});
