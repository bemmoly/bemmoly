import type { ImportMapping } from '@bemmoly/shared';
import { Icon } from '@bemmoly/ui/icons';
import { StatePill, type PillTone } from '../settings/state-pill.tsx';

export const ACTION: Record<ImportMapping['action'], { label: string; tone: PillTone }> = {
  match: { label: 'Matched', tone: 'ok' },
  create: { label: 'Created', tone: 'acc' },
  report: { label: 'Reported only', tone: 'warn' },
};

export function groups(mappings: readonly ImportMapping[]) {
  const byKind = new Map<string, ImportMapping[]>();
  for (const mapping of mappings) {
    byKind.set(mapping.kind, [...(byKind.get(mapping.kind) ?? []), mapping]);
  }
  return [...byKind.entries()];
}

export function MappingRow({ mapping }: { mapping: ImportMapping }) {
  const action = ACTION[mapping.action];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-2 py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-13 text-tx" title={mapping.source}>
        {mapping.source}
      </span>
      {mapping.target ? (
        <span className="flex min-w-0 items-center gap-1.5 text-13 text-tx-2">
          <Icon name="arrow" size={12} />
          <span className="truncate">{mapping.target}</span>
        </span>
      ) : null}
      <StatePill tone={action.tone}>{action.label}</StatePill>
      {mapping.note ? <span className="w-full text-12 text-tx-3">{mapping.note}</span> : null}
    </li>
  );
}
