/**
 * The sizing card's latency bars grow to their measured length when they come into view.
 * Without the script, or when the visitor asks for reduced motion, they are drawn at full
 * length from the start: the motion carries the data and is never needed to read it.
 */
export function enhanceBars(): void {
  const lists = document.querySelectorAll<HTMLElement>('[data-bars]');
  if (lists.length === 0 || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bars = (list: HTMLElement) => list.querySelectorAll<SVGElement>('[data-bar]');
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        for (const bar of bars(entry.target as HTMLElement)) bar.style.transform = '';
      }
    },
    { threshold: 0.4 },
  );
  for (const list of lists) {
    for (const bar of bars(list)) {
      // Collapse without the transition, so a bar never visibly shrinks before it grows.
      bar.style.transition = 'none';
      bar.style.transform = 'scaleX(0)';
      bar.getBoundingClientRect();
      bar.style.transition = '';
    }
    observer.observe(list);
  }
}
