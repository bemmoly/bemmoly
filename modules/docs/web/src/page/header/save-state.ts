import type { CollabState } from '../../collab/session.ts';
import type { ReadOnlyReason } from '../screen-context.ts';

export type SaveTone = 'quiet' | 'busy' | 'warn';

export interface SaveState {
  /** "Saved", "Saving…", "Offline · changes kept", "Read-only". */
  label: string;
  /** "Priya is editing", "3 people editing"; empty when nobody else is here. */
  others: string;
  tone: SaveTone;
}

function othersOf(peers: CollabState['peers']): string {
  if (peers.length === 0) return '';
  if (peers.length === 1) return `${firstName(peers[0]!.name)} is editing`;
  if (peers.length === 2) {
    return `${firstName(peers[0]!.name)} and ${firstName(peers[1]!.name)} are editing`;
  }
  return `${peers.length} people editing`;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * The header's save line, as the mock writes it ("Saved · Priya is editing"). The body saves
 * itself through the collaboration socket, so this is the only place saving shows: a person
 * never presses Save and never wonders whether to.
 */
export function saveState(collab: CollabState, readOnly: ReadOnlyReason): SaveState {
  const others = othersOf(collab.peers);
  if (readOnly === 'trashed') return { label: 'In the trash', others: '', tone: 'warn' };
  if (readOnly === 'archived') return { label: 'Archived · read-only', others, tone: 'quiet' };
  switch (collab.status) {
    case 'connecting':
      // Editable while connecting means it was live before: the socket dropped and is back
      // in a moment, with everything typed meanwhile kept in the tab.
      return { label: collab.editable ? 'Reconnecting…' : 'Connecting…', others: '', tone: 'busy' };
    case 'live':
      return collab.unsynced > 0
        ? { label: 'Saving…', others, tone: 'busy' }
        : { label: 'Saved', others, tone: 'quiet' };
    case 'offline':
      return { label: 'Offline · changes kept', others: '', tone: 'warn' };
    case 'read-only':
      return { label: 'Read-only', others, tone: 'quiet' };
    case 'denied':
      return { label: 'No access to edit', others: '', tone: 'warn' };
    case 'local':
      return { label: 'Saved in this tab', others: '', tone: 'quiet' };
  }
}

/**
 * What the status region says: the same, except that saving reads as saved. Saving flickers
 * on every keystroke; spoken, it would talk over the typing.
 */
export function spokenState(state: SaveState): SaveState {
  return state.label === 'Saving…' ? { ...state, label: 'Saved', tone: 'quiet' } : state;
}

/** One line for the status region, read once by assistive technology on each change. */
export function saveLine(state: SaveState): string {
  return state.others ? `${state.label} · ${state.others}` : state.label;
}
