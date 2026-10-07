import { Card } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { LINK_ACTION } from '../actions.ts';
import { RouterLink } from '../router-link.tsx';
import { StatusCircle, type CircleTone } from './status-circle.tsx';

export interface CheckRow {
  id: string;
  name: string;
  value: ReactNode;
  /** No circle for rows that only report a fact, such as the version. */
  tone?: CircleTone;
  /** Plain copy instead of the mono value, for sentences. */
  prose?: boolean;
  link?: { label: string; href: string };
}

/**
 * The Setup mock's first-step list: 16px circle, 200px name, mono value and an
 * accent action at the end, in 10px rows divided by br-row.
 */
export function CheckList({ label, rows }: { label: string; rows: readonly CheckRow[] }) {
  return (
    <Card className="flex flex-col px-4 py-1.5">
      <ul aria-label={label} className="m-0 flex list-none flex-col p-0">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-2.5 border-b border-br-row py-2.5 text-12h"
          >
            {row.tone ? <StatusCircle tone={row.tone} /> : <span className="size-4 shrink-0" />}
            <span className="w-50 shrink-0 font-medium">{row.name}</span>
            <span
              className={`min-w-0 truncate text-tx4 ${row.prose ? 'text-12h' : 'font-mono text-12'}`}
            >
              {row.value}
            </span>
            {row.link ? (
              <RouterLink href={row.link.href} className={`ml-auto ${LINK_ACTION}`}>
                {row.link.label}
              </RouterLink>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
