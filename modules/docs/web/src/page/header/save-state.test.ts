import { describe, expect, it } from 'vitest';
import type { CollabState } from '../../collab/session.ts';
import { collabUser } from '../../collab/user.ts';
import { countWords, readingTime, statsOf } from '../body/doc-stats.ts';
import { shortDate } from '../body/page-heading.tsx';
import { saveShortcutMessage } from '../use-page-shortcuts.ts';
import { saveLine, saveState, spokenState } from './save-state.ts';

const priya = collabUser({ id: 'u-priya', name: 'Priya Nair', email: 'priya@acme.test' });
const jonas = collabUser({ id: 'u-jonas', name: 'Jonas Meyer', email: 'jonas@acme.test' });
const state = (patch: Partial<CollabState> = {}): CollabState => ({
  status: 'live',
  editable: true,
  unsynced: 0,
  peers: [],
  ...patch,
});

describe('the save line', () => {
  it('reads as the mock header does, with who else is editing', () => {
    expect(saveLine(saveState(state({ peers: [priya] }), null))).toBe('Saved · Priya is editing');
    expect(saveLine(saveState(state({ unsynced: 2, peers: [priya, jonas] }), null))).toBe(
      'Saving… · Priya and Jonas are editing',
    );
    expect(saveState(state({ peers: [priya, jonas, priya] }), null).others).toBe(
      '3 people editing',
    );
  });

  it('speaks saving as saved, so the status region stays quiet while someone types', () => {
    const saving = saveState(state({ unsynced: 1, peers: [priya] }), null);
    expect(saveLine(saving)).toBe('Saving… · Priya is editing');
    expect(saveLine(spokenState(saving))).toBe('Saved · Priya is editing');
    const offline = saveState(state({ status: 'offline' }), null);
    expect(spokenState(offline)).toEqual(offline);
  });

  it('names every connection state and never claims a save it cannot make', () => {
    expect(saveState(state({ status: 'connecting', editable: false }), null).label).toBe(
      'Connecting…',
    );
    expect(saveState(state({ status: 'connecting' }), null)).toMatchObject({
      label: 'Reconnecting…',
      tone: 'busy',
    });
    expect(saveState(state({ status: 'offline' }), null)).toMatchObject({
      label: 'Offline · changes kept',
      tone: 'warn',
    });
    expect(saveState(state({ status: 'read-only' }), 'viewer').label).toBe('Read-only');
    expect(saveState(state({ status: 'denied' }), 'viewer').label).toBe('No access to edit');
    expect(saveState(state({ status: 'local' }), null).label).toBe('Saved in this tab');
  });

  it('puts the page’s own state before the connection', () => {
    expect(saveState(state(), 'trashed').label).toBe('In the trash');
    expect(saveState(state({ peers: [priya] }), 'archived')).toMatchObject({
      label: 'Archived · read-only',
      others: 'Priya is editing',
    });
  });
});

describe('⌘S', () => {
  it('says saving is automatic, and never fails', () => {
    expect(saveShortcutMessage('live', null).title).toBe('Saved automatically');
    expect(saveShortcutMessage('offline', null).body).toMatch(/sync when you reconnect/);
    expect(saveShortcutMessage('local', null).title).toBe('Saved in this tab');
    expect(saveShortcutMessage('live', 'archived').title).toBe('Nothing to save');
    expect(saveShortcutMessage('read-only', 'viewer').body).toMatch(/read only/);
  });
});

describe('page numbers', () => {
  it('counts words the way a reader would', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  Flip auth_pg_sessions off — it’s 0.5% ')).toBe(5);
    expect(countWords('Sessions\nmove  to Postgres')).toBe(4);
  });

  it('turns words into a reading time', () => {
    expect(readingTime(statsOf(0))).toBe('');
    expect(readingTime(statsOf(80))).toBe('Under a minute');
    expect(readingTime(statsOf(1380))).toBe('6 min read');
  });

  it('prints dates as the mock does, with the year only when it differs', () => {
    const now = new Date('2026-10-10T10:00:00Z');
    expect(shortDate('2026-09-12T10:00:00Z', now)).toBe('Sep 12');
    expect(shortDate('2025-09-12T10:00:00Z', now)).toBe('Sep 12, 2025');
  });
});
