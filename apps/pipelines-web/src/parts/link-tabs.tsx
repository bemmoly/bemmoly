import { focusRingInset } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useBrowserPath } from '../hooks/use-browser-path.ts';
import { cx } from '../lib/cx.ts';

export interface LinkTab {
  /** Inside the app, as the router takes it: "/platform/access". */
  to: string;
  label: string;
  icon?: IconName;
  /** A count or key hint after the label. */
  end?: ReactNode;
  /** Also current under these paths. */
  exact?: boolean;
}

/**
 * Tabs that are places: each is a link with its own address, drawn as the design system's
 * underline tabs, the current one marked for assistive tech. It scrolls inside itself on a
 * phone so the page never scrolls sideways.
 */
export function LinkTabs({ tabs, label }: { tabs: readonly LinkTab[]; label: string }) {
  const pathname = useBrowserPath().replace(/^\/pipelines/, '') || '/';
  return (
    <nav
      aria-label={label}
      className="-mx-4 overflow-x-auto border-b border-line px-4 md:-mx-6 md:px-6"
    >
      <ul className="flex gap-0.5">
        {tabs.map((tab) => {
          const current = tab.exact
            ? pathname === tab.to
            : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
          return (
            <li key={tab.to}>
              <Link
                to={tab.to}
                search={(previous) => ({ scope: previous.scope })}
                aria-current={current ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-1.5 px-3.5 py-2.25 text-13 font-medium whitespace-nowrap',
                  current ? 'text-tx shadow-tab' : 'text-tx-3 hover:text-tx-2',
                  focusRingInset,
                )}
              >
                {tab.icon && <Icon name={tab.icon} size={14} />}
                {tab.label}
                {tab.end}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
