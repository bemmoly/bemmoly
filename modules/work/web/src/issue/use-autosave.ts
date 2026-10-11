import type { SaveStateValue } from '@bemmoly/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

/** How long typing pauses before the draft is saved. */
export const AUTOSAVE_MS = 800;
/** How long "Saved" stays before the state goes quiet. */
const SAVED_MS = 2000;

/**
 * Saves a draft a moment after typing stops, and at once on `flush`. One save runs at a time;
 * a change made while one runs is saved after it. A failure keeps the draft and says so.
 */
export function useAutosave<T>(save: (value: T) => Promise<unknown>) {
  const [state, setState] = useState<SaveStateValue>('idle');
  const pending = useRef<{ value: T } | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const quiet = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestSave = useRef(save);
  useEffect(() => {
    latestSave.current = save;
  });

  const run = useCallback(async (): Promise<void> => {
    if (running.current) {
      await running.current;
      return run();
    }
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    clearTimeout(quiet.current);
    setState('saving');
    const attempt = (async () => {
      try {
        await latestSave.current(next.value);
        if (!pending.current) {
          setState('saved');
          quiet.current = setTimeout(() => setState('idle'), SAVED_MS);
        }
      } catch {
        // Keep the newest draft: a later change wins over the one that failed.
        pending.current ??= next;
        setState('error');
      }
    })();
    running.current = attempt;
    await attempt;
    running.current = null;
  }, []);

  const change = useCallback(
    (value: T) => {
      pending.current = { value };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), AUTOSAVE_MS);
    },
    [run],
  );

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    return run();
  }, [run]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(quiet.current);
      // Leaving the page mid-sentence still saves what was typed.
      if (pending.current) void run();
    },
    [run],
  );

  return { state, change, flush, retry: flush, dirty: () => pending.current !== null };
}
