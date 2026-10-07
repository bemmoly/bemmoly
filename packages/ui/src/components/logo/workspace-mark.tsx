import { cx } from '../../lib/cx.ts';

export interface WorkspaceMarkProps {
  /** The workspace name; its first letter is shown when there is no uploaded logo. */
  name: string;
  /** An uploaded workspace logo (Appearance: square, 128px minimum). */
  src?: string;
  /** 30 (doc space header), 32 (project sidebar) or 36 (Appearance logo row). */
  size?: 30 | 32 | 36;
  className?: string;
}

const SIZES = { 30: 'size-7.5 text-12', 32: 'size-8 text-13', 36: 'size-9 text-15' } as const;

/**
 * A workspace's or space's own mark: its uploaded logo, or its initial on a 7px-radius accent
 * tile (the "A" in the Appearance mock). This is not the Bemmoly logo; that is <Logo>.
 */
export function WorkspaceMark({ name, src, size = 36, className }: WorkspaceMarkProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cx('shrink-0 rounded-panel object-cover', SIZES[size], className)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={cx(
        'flex shrink-0 items-center justify-center rounded-panel bg-ac-fill font-semibold text-on-ac',
        SIZES[size],
        className,
      )}
    >
      <span aria-hidden>{name.trim().charAt(0).toUpperCase()}</span>
    </span>
  );
}
