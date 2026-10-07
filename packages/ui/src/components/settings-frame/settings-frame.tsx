import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { Card } from '../card/card.tsx';

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

export interface SettingsSectionProps {
  title: ReactNode;
  /** Light text after the title ("Select Custom above to edit"). */
  hint?: ReactNode;
  children: ReactNode;
  /** rows: SettingsRow list (6px 16px). block: free content (16px). */
  layout?: 'rows' | 'block';
  className?: string;
}

/** A settings panel: the Theme, Custom theme and Policy cards of the Appearance mock. */
export function SettingsSection({
  title,
  hint,
  children,
  layout = 'block',
  className,
}: SettingsSectionProps) {
  return (
    <Card className={className}>
      <div className="flex items-center gap-2 border-b border-br2 px-4 py-3 font-semibold">
        {title}
        {hint && <span className="text-12 font-normal text-tx5">{hint}</span>}
      </div>
      <div className={layout === 'rows' ? 'flex flex-col px-4 py-1.5' : 'flex flex-col gap-4 p-4'}>
        {children}
      </div>
    </Card>
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
