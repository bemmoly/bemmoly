import { keysForEvent } from '@bemmoly/api-client';
import { useRealtime, type RealtimeEvent } from '@bemmoly/core-web';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { realtimeUrl } from '../lib/api.ts';
import { useUiStore } from '../store/ui.ts';

/** One socket per tab for the signed-in person; events invalidate the matching queries. */
export function useRealtimeSync(userId: string) {
  const queryClient = useQueryClient();
  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      for (const queryKey of keysForEvent(event.kind))
        void queryClient.invalidateQueries({ queryKey });
    },
    [queryClient],
  );
  return useRealtime({ url: realtimeUrl(), scopes: [`user:${userId}`], enabled: true, onEvent });
}

function typingInField(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

/** ⌘K or Ctrl+K toggles the palette anywhere; "/" opens it when not typing. */
export function useGlobalHotkeys() {
  const togglePalette = useUiStore((state) => state.togglePalette);
  const openPalette = useUiStore((state) => state.openPalette);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        togglePalette();
      } else if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !typingInField(event.target)
      ) {
        event.preventDefault();
        openPalette();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [togglePalette, openPalette]);
}
