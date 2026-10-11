import { useEffect, useRef, useState } from 'react';

interface Stage {
  w: number;
  h: number;
}

/**
 * The scale that fits a fixed-size drawing into an element: within its width less a margin and
 * about 80% of its height, never past `max`. `width` is the element's own, so a caller can pick an arrangement.
 */
export function useFitScale(stages: { wide: Stage; narrow: Stage }, max = Infinity) {
  const ref = useRef<HTMLElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  if (!box) return { ref, width: null, scale: 1 };
  const stage = box.width < 800 ? stages.narrow : stages.wide;
  const fit = Math.min((box.width - 40) / stage.w, (box.height * 0.8) / stage.h);
  const scale = Math.max(0.4, Math.min(fit, max));
  return { ref, width: box.width, scale };
}
