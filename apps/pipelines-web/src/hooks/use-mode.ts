import { usePreference } from '@bemmoly/core-web';
import { useEffect, useSyncExternalStore } from 'react';

export type PipelinesMode = 'dark' | 'light';
/** What the person chose: a mode, or whatever the system says. */
export type ModePreference = PipelinesMode | 'system';

const DARK = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(DARK);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const systemMode = (): PipelinesMode =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  !window.matchMedia(DARK).matches
    ? 'light'
    : 'dark';

/**
 * Dark by default: engineers keep Pipelines open beside an editor and a terminal. Light,
 * Dark or Match system, as Bemmoly offers them, remembered for the person on this device and
 * apart from Bemmoly's own mode. T flips what is showing to the other mode.
 */
export function useMode() {
  const [preference, setPreference] = usePreference<ModePreference>('pipelines.mode', 'dark');
  const system = useSyncExternalStore(subscribe, systemMode, () => 'dark' as const);
  const mode: PipelinesMode = preference === 'system' ? system : preference;
  useEffect(() => {
    document.documentElement.dataset['mode'] = mode;
  }, [mode]);
  return {
    mode,
    preference,
    setPreference,
    toggle: () => setPreference(mode === 'dark' ? 'light' : 'dark'),
  };
}

export type Appearance = ReturnType<typeof useMode>;
