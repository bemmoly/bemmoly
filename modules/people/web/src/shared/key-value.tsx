import type { ReactNode } from 'react';

/** One label and value row in a card, as profile facts read. */
export function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[132px_minmax(0,1fr)] items-center gap-2.5 border-b border-line-2 px-3.5 py-1.5 text-13 last:border-b-0 max-sm:grid-cols-[104px_minmax(0,1fr)]">
      <span className="text-tx-2">{label}</span>
      <span className="min-w-0 truncate text-tx">{children}</span>
    </div>
  );
}
