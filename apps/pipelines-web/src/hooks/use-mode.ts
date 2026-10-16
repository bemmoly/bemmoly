import { usePreference } from '@bemmoly/core-web';
import { useEffect } from 'react';

export type PipelinesMode = 'dark' | 'light';

/**
 * Dark by default: engineers keep Pipelines open beside an editor and a terminal. Light is one
 * key away (T) and is remembered for the person on this device, apart from Bemmoly's own
 * mode, so choosing light here never changes Work and Docs.
 */
export function useMode() {
  const [mode, setMode] = usePreference<PipelinesMode>('pipelines.mode', 'dark');
  useEffect(() => {
    document.documentElement.dataset['mode'] = mode;
  }, [mode]);
  return { mode, toggle: () => setMode(mode === 'dark' ? 'light' : 'dark') };
}
