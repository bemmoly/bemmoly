import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

export interface SettingsFrameProps {
  /** A SettingsNav. */
  nav: ReactNode;
  children: ReactNode;
  /** A right rail such as the Board Settings live preview. */
  aside?: ReactNode;
  className?: string;
}

/** Sidebar plus scrolling content, filling the space under the top bar. */
export function SettingsFrame({ nav, children, aside, className }: SettingsFrameProps) {
  return (
    <div className={cx('flex min-h-0 flex-1 bg-bg', className)}>
      {nav}
      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      {aside}
    </div>
  );
}

export interface SettingsContentProps {
  children: ReactNode;
  /**
   * wide: Workspace settings (1120px, 28px 40px 48px, 28px gap).
   * narrow: project settings beside a preview rail (960px, 28px 32px 60px, 24px gap).
   */
  width?: 'wide' | 'narrow';
  className?: string;
}

export function SettingsContent({ children, width = 'wide', className }: SettingsContentProps) {
  return (
    <div
      className={cx(
        'flex flex-col',
        width === 'wide' ? 'max-w-280 gap-7 px-10 pt-7 pb-12' : 'max-w-240 gap-6 px-8 pt-7 pb-15',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface SettingsRowProps {
  title: ReactNode;
  description?: ReactNode;
  /** The control: a Switch, a link-style action, a Select. */
  control?: ReactNode;
  className?: string;
}

/** 10px rows divided by br-row: medium title, 12px tx5 description, control on the right. */
export function SettingsRow({ title, description, control, className }: SettingsRowProps) {
  return (
    <div
      className={cx(
        'flex items-center gap-3 border-b border-br-row py-2.5 last:border-b-0',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        {description && <span className="text-12 text-tx5">{description}</span>}
      </div>
      {control}
    </div>
  );
}
