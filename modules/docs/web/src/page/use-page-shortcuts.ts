import { useToast } from '@bemmoly/ui';
import { useEffect, useRef } from 'react';
import type { CollabStatus } from '../collab/session.ts';
import { usePageChrome, type MarginId, type ReadOnlyReason } from './screen-context.ts';

/** What ⌘S says, given where the page is: never an error, never a no-op. */
export function saveShortcutMessage(
  status: CollabStatus,
  readOnly: ReadOnlyReason,
): { title: string; body?: string } {
  if (readOnly === 'trashed')
    return { title: 'Nothing to save', body: 'This page is in the trash.' };
  if (readOnly === 'archived' || readOnly === 'viewer' || status === 'read-only') {
    return { title: 'Nothing to save', body: 'This page is open to read only.' };
  }
  if (status === 'offline') {
    return { title: 'Saved on this device', body: 'Your changes sync when you reconnect.' };
  }
  if (status === 'local') return { title: 'Saved in this tab' };
  return { title: 'Saved automatically', body: 'Bemmoly saves as you type.' };
}

const isMod = (event: KeyboardEvent) =>
  (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;

/** ⌘⌥ (Ctrl+Alt) with a letter, read from the physical key: Alt changes event.key on a Mac. */
const MOD_ALT: Record<string, MarginId | 'history'> = {
  KeyO: 'outline',
  KeyC: 'comments',
  KeyL: 'linked',
  KeyH: 'history',
};

/**
 * The page's own keys: ⌘S (Ctrl+S) answers that saving is automatic instead of opening the
 * browser's save dialog; ⌘⌥O, ⌘⌥C and ⌘⌥L show or hide the outline, comments and linked
 * work in the margin; ⌘⌥H enters or leaves version history.
 */
export function usePageShortcuts(
  status: CollabStatus,
  readOnly: ReadOnlyReason,
  /** Whether the margin shows this view on screen now, so its key closes it. */
  shown: (id: MarginId) => boolean,
) {
  const { show } = useToast();
  const latestShown = useRef(shown);
  useEffect(() => {
    latestShown.current = shown;
  });
  const latest = useRef({ status, readOnly });
  useEffect(() => {
    latest.current = { status, readOnly };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const chord = MOD_ALT[event.code];
      if ((event.metaKey || event.ctrlKey) && event.altKey && !event.shiftKey && chord) {
        event.preventDefault();
        const chrome = usePageChrome.getState();
        if (chord === 'history') {
          if (latest.current.readOnly !== 'trashed')
            chrome.setMode(chrome.mode === 'history' ? 'page' : 'history');
        } else chrome.toggleMargin(chord, latestShown.current(chord));
        return;
      }
      if (!isMod(event)) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        show({
          tone: 'ok',
          ...saveShortcutMessage(latest.current.status, latest.current.readOnly),
          duration: 2500,
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [show]);
}
