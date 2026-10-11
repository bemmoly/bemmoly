import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { useCountdown } from './use-countdown.ts';

/** How often a page that lost the server checks again on its own. */
export const RETRY_SECONDS = 20;

/**
 * While the server is not answering: asks /readyz every 20 seconds (and on "Try again now"),
 * and calls `onBack` once it answers ready. Nothing typed into the page is touched.
 */
export function useServerReady(onBack: () => void) {
  const [down, setDown] = useState(false);
  const [checking, setChecking] = useState(false);
  const { left, start, stop } = useCountdown();
  const timer = useRef<number | undefined>(undefined);
  const back = useRef(onBack);
  useEffect(() => {
    back.current = onBack;
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const again = useRef<() => void>(() => undefined);
  const later = useCallback(() => {
    start(RETRY_SECONDS);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => again.current(), RETRY_SECONDS * 1000);
  }, [start]);

  const check = useCallback(async () => {
    window.clearTimeout(timer.current);
    setChecking(true);
    try {
      await api.setup.readiness();
      setDown(false);
      stop();
      back.current();
    } catch {
      later();
    } finally {
      setChecking(false);
    }
  }, [later, stop]);
  useEffect(() => {
    again.current = () => void check();
  }, [check]);

  return {
    down,
    checking,
    secondsLeft: left,
    /** The server stopped answering: check again on our own every 20 seconds. */
    lost: useCallback(() => {
      setDown(true);
      later();
    }, [later]),
    retryNow: () => void check(),
  };
}
