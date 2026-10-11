import { useCallback, useEffect, useState } from 'react';

/**
 * Seconds left until a moment, ticking once a second; 0 once it has passed. `start(seconds)`
 * sets the moment, so a rate limit or a resend cooldown counts down from the server's wait.
 */
export function useCountdown() {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const tick = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) setUntil(null);
    }, 1000);
    return () => window.clearInterval(tick);
  }, [until]);
  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setUntil(current + seconds * 1000);
  }, []);
  const left = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  return { left, running: left > 0, start, stop: useCallback(() => setUntil(null), []) };
}
