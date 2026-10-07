/**
 * PLACEHOLDER for @bemmoly/ui StatusBadge, in the one form the shell needs:
 * the 16px round glyph of the health checks and the setup summary.
 */
export type StatusTone = 'ok' | 'warn' | 'danger';

const FILL: Record<StatusTone, string> = { ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger' };

export function StatusBadge({ tone, glyph }: { tone: StatusTone; glyph?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-4 shrink-0 place-items-center rounded-full text-micro leading-none text-on-status ${FILL[tone]}`}
    >
      {glyph ?? (tone === 'ok' ? '✓' : '!')}
    </span>
  );
}
