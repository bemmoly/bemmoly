import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { isApple, keyFace, parseKeys, spokenKeys } from './keys.ts';

export interface KbdProps {
  /** The shortcut in words ("Mod+K", "Up Down", "Esc"); typed symbols are read too. */
  keys: string;
  /** chip: bordered, as in menus, the palette and tooltips. plain: no frame, as in a search box. */
  variant?: 'chip' | 'plain';
  className?: string;
}

const MODIFIERS: ReadonlySet<string> = new Set(['mod', 'shift', 'alt']);

const VARIANTS = {
  chip: 'rounded-chip border border-line bg-canvas px-1',
  plain: '',
} as const;

/**
 * A keyboard shortcut. Modifiers and arrows are drawn as icons on Apple platforms and as words
 * elsewhere ("Ctrl"), never as characters a font may not have (docs/design/premium/kit.css,
 * `.kbd`). Assistive tech hears the keys spelled out.
 */
export function Kbd({ keys, variant = 'chip', className }: KbdProps) {
  const apple = isApple();
  const parts = parseKeys(keys);
  return (
    <kbd
      className={cx(
        'inline-flex shrink-0 items-center gap-0.5 font-mono text-11 leading-4 font-normal text-tx-3',
        VARIANTS[variant],
        className,
      )}
    >
      {parts.map((part, i) => {
        const face = 'name' in part ? keyFace(part.name, apple) : part;
        // Off Apple platforms a chord reads "Ctrl+K"; a run of keys ("Up Down") is not joined.
        const previous = parts[i - 1];
        const joiner =
          !apple && previous && 'name' in previous && MODIFIERS.has(previous.name) ? '+' : '';
        return (
          <span key={i} aria-hidden className="inline-flex items-center">
            {joiner}
            {'icon' in face ? <Icon name={face.icon} size={11} /> : face.text}
          </span>
        );
      })}
      <span className="sr-only">{spokenKeys(keys, apple)}</span>
    </kbd>
  );
}
