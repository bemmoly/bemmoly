import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

export interface SettingsFrameProps {
  /** Unused: the app sidebar shows the settings contents. Kept while pages move over. */
  nav?: ReactNode;
  children: ReactNode;
  /** A right rail such as the Board Settings live preview. */
  aside?: ReactNode;
  className?: string;
}

/** Scrolling content and an optional rail (a live preview), filling the page's body. */
export function SettingsFrame({ children, aside, className }: SettingsFrameProps) {
  return (
    <div className={cx('flex min-h-0 flex-1 bg-canvas', className)}>
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
      {aside}
    </div>
  );
}

export interface SettingsContentProps {
  children: ReactNode;
  /**
   * wide: Workspace settings, the contained 1040px reading column (28px 32px 48px, 24px gap).
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
        width === 'wide'
          ? 'mx-auto w-full max-w-260 gap-6 px-4 pt-5 pb-12 sm:px-8 sm:pt-7'
          : 'max-w-240 gap-6 px-8 pt-7 pb-15',
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

/** 10px rows divided by the light line: medium title, 12px tx-3 description, control right. */
export function SettingsRow({ title, description, control, className }: SettingsRowProps) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-center gap-3 border-b border-line-2 py-2.5 last:border-b-0',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        {description && <span className="text-12 text-tx-3">{description}</span>}
      </div>
      {control}
    </div>
  );
}
