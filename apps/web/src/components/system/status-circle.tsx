export type CircleTone = 'ok' | 'caution' | 'danger';

const LOOK: Record<CircleTone, { bg: string; glyph: string; label: string }> = {
  ok: { bg: 'bg-ok', glyph: '✓', label: 'OK' },
  caution: { bg: 'bg-caution', glyph: '!', label: 'Needs attention' },
  danger: { bg: 'bg-danger', glyph: '×', label: 'Failed' },
};

/** The 16px check circle of the Setup mock's first step (10px glyph on ok, caution or danger). */
export function StatusCircle({ tone }: { tone: CircleTone }) {
  const look = LOOK[tone];
  return (
    <span
      role="img"
      aria-label={look.label}
      className={`flex size-4 shrink-0 items-center justify-center rounded-full text-10 text-on-solid ${look.bg}`}
    >
      <span aria-hidden="true">{look.glyph}</span>
    </span>
  );
}
