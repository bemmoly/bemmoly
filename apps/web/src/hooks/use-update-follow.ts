import type { UpdatesOverview } from '@bemmoly/shared';
import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';

/** How often Settings › Updates reads the overview while an update runs. */
export const UPDATE_POLL_MS = 1000;
/** Set just before the page reloads onto the new version, so the reloaded page says so. */
const RELOADED_KEY = 'bemmoly.update.reloaded';

function readReloaded(): string | null {
  try {
    const value = sessionStorage.getItem(RELOADED_KEY);
    sessionStorage.removeItem(RELOADED_KEY);
    return value;
  } catch {
    return null;
  }
}

/** Resolves once /readyz answers ready, checking every second; the app is restarting. */
export async function waitForReady(signal: AbortSignal, poll = UPDATE_POLL_MS): Promise<void> {
  while (!signal.aborted) {
    const answer = await api.setup.readiness().catch(() => null);
    if (answer?.status === 'ready') return;
    await new Promise((resolve) => setTimeout(resolve, poll));
  }
}

export interface UpdateFollow {
  /** The page is watching an update: polling fast and ready to reload. */
  following: boolean;
  /** The overview stopped answering: the new version is starting. */
  restarting: boolean;
  /** The version this page reloaded onto at the end of an update, once. */
  reloadedFor: string | null;
  /** The admin started an update from this page. */
  follow: (target: string) => void;
}

/**
 * Follows an update across the app restarting. Every admin on the page follows a running
 * update, not only the one who started it. When the overview reports the target version and
 * /readyz says ready, the page reloads so its code matches the server again.
 */
export function useUpdateFollow(overview: UpdatesOverview | undefined, failing: boolean) {
  const [started, setStarted] = useState<string | null>(null);
  const [reloadedFor] = useState(readReloaded);
  /** The version this page's code was loaded with: the first one the overview reported. */
  const [loadedVersion, setLoadedVersion] = useState<string | null>(null);
  const version = overview?.current.version;
  if (version && loadedVersion === null) setLoadedVersion(version);

  const progress = overview?.updater.progress;
  const running = progress?.outcome === 'running';
  const following = Boolean(started) || running;
  // The server runs another version than this page's code: whatever the page saw of the
  // update, it reloads once the new version is ready.
  const arrived = version !== undefined && loadedVersion !== null && version !== loadedVersion;

  useEffect(() => {
    if (!arrived || !version) return;
    const controller = new AbortController();
    void waitForReady(controller.signal).then(() => {
      if (controller.signal.aborted) return;
      try {
        sessionStorage.setItem(RELOADED_KEY, version);
      } catch {
        // Without storage the reloaded page simply shows the overview.
      }
      window.location.reload();
    });
    return () => controller.abort();
  }, [arrived, version]);

  // A finished update ends the following; how it ended stays on screen.
  if (started && progress && progress.outcome !== 'running' && progress.target === started)
    setStarted(null);

  return {
    following,
    restarting: following && (failing || arrived),
    reloadedFor,
    follow: setStarted,
  } satisfies UpdateFollow;
}
