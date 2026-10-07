import type { NavEntry } from '@bemmoly/shared';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { LogoMark } from './logo-mark.tsx';

interface TopBarProps {
  entries: readonly NavEntry[];
  trailing?: ReactNode;
}

const NAV_LINK = 'rounded-control px-2.5 py-1.5 text-tx2';
const NAV_ACTIVE = 'rounded-none font-medium text-tx shadow-[inset_0_-2px_0_var(--ac)]';

/** Measurements from the top bar of the Board mock (docs/design/mocks). */
export function TopBar({ entries, trailing }: TopBarProps) {
  return (
    <header className="flex h-topbar shrink-0 items-center gap-1 border-b border-br bg-sf pr-3 pl-4">
      <Link
        to="/"
        className="mr-1.5 flex h-7 items-center gap-2.25 border-r border-br pr-3.5 text-tx"
      >
        <LogoMark />
        <span className="text-brand font-semibold tracking-[-0.01em]">Bemmoly</span>
      </Link>
      <nav aria-label="Modules" className="flex gap-0.5 text-nav">
        {entries.map((entry) => (
          <Link
            key={entry.id}
            to={entry.path}
            className={NAV_LINK}
            activeProps={{ className: NAV_ACTIVE }}
          >
            {entry.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">{trailing}</div>
    </header>
  );
}
