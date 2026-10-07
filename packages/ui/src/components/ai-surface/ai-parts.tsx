import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

/** The dot that marks AI-produced content: 7px on cards, 8px on the Ask pill, 9px in ⌘K. */
export function AiDot({ size = 7, className }: { size?: 7 | 8 | 9; className?: string }) {
  const sizes = { 7: 'size-1.75', 8: 'size-2', 9: 'size-2.25' } as const;
  return (
    <span
      aria-hidden
      className={cx('inline-block shrink-0 rounded-full bg-ai', sizes[size], className)}
    />
  );
}

export interface AiActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** md: Issue page and Home brief (5px 10px). sm: drawer summary and suggestions (4px 9px). */
  size?: 'sm' | 'md';
}

/** An action the AI proposes: AI accent text on white with the AI border. */
export function AiActionButton({
  size = 'sm',
  className,
  type = 'button',
  ...rest
}: AiActionButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center border border-ai-br bg-sf font-sans font-medium whitespace-nowrap text-ai',
        size === 'sm' ? 'rounded-xs px-2.25 py-1 text-12h' : 'rounded-xs px-2.5 py-1.25',
        'enabled:hover:bg-ai-bg disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        className,
      )}
      {...rest}
    />
  );
}

/** The "Not useful" affordance after every AI answer: borderless tx4 text. */
export function AiNotUseful({
  size = 'sm',
  className,
  children = 'Not useful',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center rounded-xs border-0 bg-transparent font-sans text-tx4 hover:text-tx2',
        size === 'sm' ? 'px-2.25 py-1 text-12h' : 'px-2.5 py-1.25',
        focusRing,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface AiAskButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: ReactNode;
  /** Key hint after the label, e.g. "⌘K". */
  shortcut?: string;
  /** md: top bar (32px, 0 12px, 6px radius). sm: Doc Editor "Copilot" (30px, 0 10px, 5px). */
  size?: 'sm' | 'md';
  /** Pressed state, e.g. the Copilot panel is open. */
  pressed?: boolean;
}

/** The way into AI: "Ask Bemmoly ⌘K" in the top bar, "Copilot" in the Doc Editor. */
export function AiAskButton({
  label = 'Ask Bemmoly',
  shortcut,
  size = 'md',
  pressed,
  className,
  type = 'button',
  ...rest
}: AiAskButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut === '⌘K' ? 'Meta+K Control+K' : undefined}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center border border-ai-br font-sans font-medium whitespace-nowrap text-ai',
        size === 'md'
          ? 'h-control gap-1.75 rounded-control px-3'
          : 'h-7.5 gap-1.5 rounded-sm px-2.5',
        size === 'md' || pressed ? 'bg-ai-tint' : 'bg-sf',
        focusRing,
        className,
      )}
      {...rest}
    >
      <AiDot size={size === 'md' ? 8 : 7} />
      {label}
      {shortcut && <kbd className="font-mono text-11 font-medium text-ai-mute">{shortcut}</kbd>}
    </button>
  );
}
