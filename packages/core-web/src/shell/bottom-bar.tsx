import { Icon, type IconName } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { isActivePath, useFrame, useFrameLink } from './frame-context.ts';

export interface BottomBarItem {
  id: string;
  label: string;
  icon: IconName | ReactNode;
  path: string;
  exact?: boolean;
  /** Unread, drawn as a dot on the icon. */
  pill?: number;
}

function Item({ item }: { item: BottomBarItem }) {
  const { pathname } = useFrame();
  const link = useFrameLink(item.path);
  const on = isActivePath(pathname, item.path, item.exact);
  return (
    <a
      {...link}
      aria-current={on ? 'page' : undefined}
      aria-label={item.pill ? `${item.label}, ${item.pill} unread` : undefined}
      className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-11 text-tx-3 no-underline focus-ring-inset aria-[current=page]:text-acc"
    >
      <span className="relative">
        {typeof item.icon === 'string' ? (
          <Icon name={item.icon as IconName} size={20} />
        ) : (
          item.icon
        )}
        {item.pill ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-1 size-2 rounded-full bg-acc ring-2 ring-canvas"
          />
        ) : null}
      </span>
      <span className="max-w-full truncate">{item.label}</span>
    </a>
  );
}

/**
 * The phone's bottom bar (docs/design/premium/screens.js, `screenMobile`): two places, the New
 * button in the middle within thumb reach, two more places. 44px targets, above the home
 * indicator's safe area.
 */
export function BottomBar({
  items,
  primary,
}: {
  items: readonly BottomBarItem[];
  primary: ReactNode;
}) {
  const half = Math.ceil(items.length / 2);
  return (
    <nav
      aria-label="Quick navigation"
      className="flex h-16 shrink-0 items-stretch border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)]"
    >
      {items.slice(0, half).map((item) => (
        <Item key={item.id} item={item} />
      ))}
      <div className="grid flex-1 place-items-center">{primary}</div>
      {items.slice(half).map((item) => (
        <Item key={item.id} item={item} />
      ))}
    </nav>
  );
}
