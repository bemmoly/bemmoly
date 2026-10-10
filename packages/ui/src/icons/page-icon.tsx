import { cx } from '../lib/cx.ts';
import { Icon, type IconName } from './icon.tsx';

/**
 * Page and template icons are stored as an emoji or as a Lucide icon name ("file-text").
 * The names the built-in templates use map to the kit's own icons; any other name falls
 * back to the doc icon, so a name never prints as text.
 */
const NAMED: Record<string, IconName> = {
  'file-text': 'doc',
  file: 'doc',
  'alert-triangle': 'alert',
  'circle-alert': 'alert',
  terminal: 'code',
  code: 'code',
  users: 'people',
  'git-commit': 'workflow',
  workflow: 'workflow',
  layout: 'table',
  table: 'table',
  settings: 'settings',
  key: 'key',
  server: 'server',
};

/** True for a stored icon that is a name rather than an emoji. */
export const isIconName = (value: string) => /^[a-z][a-z0-9-]*$/.test(value);

export interface PageIconProps {
  /** The stored icon: an emoji, an icon name, or nothing for the doc icon. */
  value?: string | null;
  size?: number;
  className?: string;
}

/** A page's or template's icon, drawn the same way in the tree, the lists and the picker. */
export function PageIcon({ value, size = 16, className }: PageIconProps) {
  if (value && !isIconName(value)) {
    return (
      <span
        aria-hidden
        style={{ fontSize: size - 2 }}
        className={cx('inline-flex shrink-0 leading-none', className)}
      >
        {value}
      </span>
    );
  }
  return <Icon name={(value && NAMED[value]) || 'doc'} size={size} className={className} />;
}
