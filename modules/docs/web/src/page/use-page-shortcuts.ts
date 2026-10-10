import { useToast } from '@bemmoly/ui';
import { useEffect, useRef } from 'react';
import type { CollabStatus } from '../collab/session.ts';
import { ABOUT_PANEL, usePageChrome, type ReadOnlyReason } from './screen-context.ts';

/** What ⌘S says, given where the page is: never an error, never a no-op. */
export function saveShortcutMessage(
  status: CollabStatus,
  readOnly: ReadOnlyReason,
): { title: string; body?: string } {
  if (readOnly === 'trashed') return { title: 'Nothing to save', body: 'This page is in the trash.' };
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

/**
 * The page's own keys: ⌘S (Ctrl+S) answers that saving is automatic instead of opening the
 * browser's save dialog, and ⌘. (Ctrl+.) shows or hides the About panel.
 */
export function usePageShortcuts(status: CollabStatus, readOnly: ReadOnlyReason) {
  const { show } = useToast();
  const togglePanel = usePageChrome((state) => state.togglePanel);
  const latest = useRef({ status, readOnly });
  useEffect(() => {
    latest.current = { status, readOnly };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isMod(event)) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        show({ tone: 'ok', ...saveShortcutMessage(latest.current.status, latest.current.readOnly), duration: 2500 });
      } else if (key === '.') {
        event.preventDefault();
        togglePanel(ABOUT_PANEL);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [show, togglePanel]);
}
