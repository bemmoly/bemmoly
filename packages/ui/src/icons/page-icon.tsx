import { EPIC_COLORS } from '../tokens/semantic.ts';
import { cx } from '../lib/cx.ts';
import { Icon, ICON_NAMES, type IconName } from './icon.tsx';

/**
 * Page and template icons are stored as an emoji, as an icon name ("file-text"), or as a
 * drawn icon in one of the eight entity tints ("flag:epic-3"). The names the built-in
 * templates use map to the kit's own icons; any other unknown name falls back to the doc
 * icon, so a name never prints as text.
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

export type PageIconTint = keyof typeof EPIC_COLORS;

/** The eight tints a drawn page icon can take, in picker order. */
export const PAGE_ICON_TINTS = Object.keys(EPIC_COLORS) as PageIconTint[];

/** Spelled out so Tailwind sees every class. */
const TINT_TEXT: Record<PageIconTint, string> = {
  'epic-1': 'text-epic-1',
  'epic-2': 'text-epic-2',
  'epic-3': 'text-epic-3',
  'epic-4': 'text-epic-4',
  'epic-5': 'text-epic-5',
  'epic-6': 'text-epic-6',
  'epic-7': 'text-epic-7',
  'epic-8': 'text-epic-8',
};

export const pageIconTintClass = (tint: PageIconTint) => TINT_TEXT[tint];

/** True for a stored icon that is a name (tinted or not) rather than an emoji. */
export const isIconName = (value: string) => /^[a-z][a-z0-9-]*(:epic-[1-8])?$/.test(value);

/** A stored drawn icon split into its drawing and its tint; null for an emoji or nothing. */
export function parsePageIcon(
  value: string | null | undefined,
): { name: IconName; tint: PageIconTint | null } | null {
  if (!value || !isIconName(value)) return null;
  const [raw = '', tint] = value.split(':');
  const name =
    NAMED[raw] ?? ((ICON_NAMES as readonly string[]).includes(raw) ? (raw as IconName) : 'doc');
  return { name, tint: (tint as PageIconTint | undefined) ?? null };
}

/** The stored form of a drawn icon: "flag", or "flag:epic-3" with a tint. */
export const formatPageIcon = (name: IconName, tint: PageIconTint | null) =>
  tint ? `${name}:${tint}` : name;

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
  const drawn = parsePageIcon(value);
  return (
    <Icon
      name={drawn?.name ?? 'doc'}
      size={size}
      className={cx(drawn?.tint && TINT_TEXT[drawn.tint], className)}
    />
  );
}
