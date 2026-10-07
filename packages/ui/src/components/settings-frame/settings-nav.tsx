import { useId, type ElementType, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export interface SettingsNavProps {
  /** "Workspace settings", or a project block (tile, name, "Project settings"). */
  title: ReactNode;
  children: ReactNode;
  /** Bottom note over a br2 rule ("You're a Project admin."). */
  footer?: ReactNode;
  /** Names the navigation landmark. */
  label?: string;
  className?: string;
}

/** The settings sidebar: 240px, white, br rule on the right, 16px 8px padding, 14px between groups. */
export function SettingsNav({
  title,
  children,
  footer,
  label = 'Settings',
  className,
}: SettingsNavProps) {
  return (
    <nav
      aria-label={label}
      className={cx(
        'flex w-60 shrink-0 flex-col overflow-auto border-r border-br bg-sf',
        className,
      )}
    >
      <div className="flex flex-col gap-3.5 px-2 py-4">
        {typeof title === 'string' ? (
          <div className="px-2.5 pb-1 text-14 font-semibold">{title}</div>
        ) : (
          title
        )}
        {children}
      </div>
      {footer && (
        <div className="mt-auto flex flex-col gap-1.5 border-t border-br2 px-4 py-3 text-12 text-tx4">
          {footer}
        </div>
      )}
    </nav>
  );
}

export interface SettingsNavSectionProps {
  label: string;
  children: ReactNode;
}

/** A group: 11px medium capitals in tx5 (4px 10px 6px, .07em), items 1px apart. */
export function SettingsNavSection({ label, children }: SettingsNavSectionProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-px">
      <div
        id={id}
        className="px-2.5 pt-1 pb-1.5 text-11 font-medium tracking-label text-tx5 uppercase"
      >
        {label}
      </div>
      <ul aria-labelledby={id} className="m-0 flex list-none flex-col gap-px p-0">
        {children}
      </ul>
    </div>
  );
}

export interface SettingsNavItemProps {
  children: ReactNode;
  active?: boolean;
  /** Mono count on the right ("Users 42"). */
  count?: number;
  /** Short note on the right ("Org default", or "Overridden" with tone accent). */
  meta?: ReactNode;
  metaTone?: 'muted' | 'accent';
  href?: string;
  /** Router link component and its props, e.g. TanStack Router's Link with `to`. */
  linkAs?: ElementType;
  linkProps?: Record<string, unknown>;
  onClick?: () => void;
}

/** 7px 10px, 6px radius, tx2; the current page is accent on ac-bg, medium weight. */
export function SettingsNavItem({
  children,
  active,
  count,
  meta,
  metaTone = 'muted',
  href,
  linkAs,
  linkProps,
  onClick,
}: SettingsNavItemProps) {
  const Component: ElementType = linkAs ?? (href ? 'a' : 'button');
  const isButton = Component === 'button';
  return (
    <li className="flex">
      <Component
        {...(isButton ? { type: 'button' } : { href })}
        {...linkProps}
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'flex w-full cursor-pointer items-center justify-between gap-2 rounded-control border-0 px-2.5 py-1.75 text-left font-sans text-13 no-underline',
          active ? 'bg-ac-bg font-medium text-ac' : 'bg-transparent text-tx2 hover:bg-bg2',
          focusRing,
        )}
      >
        <span className="truncate">{children}</span>
        {count !== undefined && (
          <span className="font-mono text-11 font-medium text-tx5">{count}</span>
        )}
        {meta && (
          <span
            className={cx('text-11 font-normal', metaTone === 'accent' ? 'text-ac' : 'text-tx5')}
          >
            {meta}
          </span>
        )}
      </Component>
    </li>
  );
}
