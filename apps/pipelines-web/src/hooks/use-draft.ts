import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * A search box over a value that lives in the address: what the person types shows at once,
 * and reaches the address a beat after they stop, so each keystroke is not a navigation.
 */
export function useDraft(value: string, commit: (next: string) => void, delayMs = 250) {
  const [draft, setDraft] = useState<string | null>(null);
  const latest = useRef(commit);
  useLayoutEffect(() => {
    latest.current = commit;
  });
  useEffect(() => {
    if (draft === null) return undefined;
    const timer = setTimeout(() => {
      latest.current(draft.trim());
      setDraft(null);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [draft, delayMs]);
  return [draft ?? value, setDraft] as const;
}
