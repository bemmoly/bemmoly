import { Card } from '@bemmoly/ui';
import type { HealthRow, HealthRowStatus } from '../../hooks/use-setup-health.ts';
import { RouterLink } from '../router-link.tsx';

const CIRCLE: Record<HealthRowStatus, { look: string; glyph: string; label: string }> = {
  ok: { look: 'bg-ok', glyph: '✓', label: 'OK' },
  warning: { look: 'bg-caution', glyph: '!', label: 'Needs attention' },
  failed: { look: 'bg-danger', glyph: '!', label: 'Failed' },
  pending: { look: 'border border-br-ctl bg-sf', glyph: '', label: 'Not checked yet' },
};

/** The 16px status circle of the Setup checks and summary rows. */
export function StatusCircle({ status }: { status: HealthRowStatus }) {
  const circle = CIRCLE[status];
  return (
    <>
      <span
        aria-hidden="true"
        className={`flex size-4 shrink-0 items-center justify-center rounded-full text-10 text-on-solid ${circle.look}`}
      >
        {circle.glyph}
      </span>
      <span className="sr-only">{circle.label}</span>
    </>
  );
}

/** Step 1's check list: status, name, the measured value, and a fix link when there is one. */
export function HealthList({ rows }: { rows: readonly HealthRow[] }) {
  return (
    <Card aria-label="Server checks" className="flex flex-col px-4 py-1.5">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex items-center gap-2.5 border-b border-br-row py-2.5 text-12h last:border-b-0"
        >
          <StatusCircle status={row.status} />
          <span
            className={`w-50 shrink-0 font-medium ${row.status === 'pending' ? 'text-tx4' : 'text-tx'}`}
          >
            {row.name}
          </span>
          <span className="min-w-0 truncate font-mono text-12 text-tx4">{row.detail}</span>
          {row.fix ? (
            <RouterLink href={row.fix.href} className="ml-auto shrink-0 font-medium text-ac">
              {row.fix.label}
            </RouterLink>
          ) : row.hint ? (
            <span className="ml-auto shrink-0 text-12 text-tx5">{row.hint}</span>
          ) : null}
        </div>
      ))}
    </Card>
  );
}
