import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { useDialog } from '../../lib/use-dialog.ts';
import { AiDot } from '../ai-surface/ai-parts.tsx';

const CommandContext = createContext<{ listId: string }>({ listId: '' });
export const useCommandContext = () => useContext(CommandContext);

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  label?: string;
  children: ReactNode;
  /** Render in place instead of as a modal: for stories, docs and screenshots. */
  inline?: boolean;
}

const OPTION = '[role="option"]';

/**
 * The ⌘K surface of the Command mock: 760px wide, 96px from the top, 12px radius, over the
 * scrim. Focus stays in the input; ↑ and ↓ move through the options, ⏎ chooses, Esc closes.
 */
export function CommandPalette({
  open,
  onClose,
  label = 'Command palette',
  children,
  inline = false,
}: CommandPaletteProps) {
  const { ref, onBackdropClick } = useDialog(open && !inline, onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const host = (): HTMLElement | null => (inline ? panelRef.current : ref.current);
  const listId = useId();
  const [active, setActive] = useState(0);

  useLayoutEffect(() => {
    const dialog = host();
    if (!dialog) return;
    const options = [...dialog.querySelectorAll<HTMLElement>(OPTION)];
    const index = Math.min(active, Math.max(options.length - 1, 0));
    options.forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
    const input = dialog.querySelector<HTMLInputElement>('[role="combobox"]');
    const current = options[index];
    if (input) {
      if (current) input.setAttribute('aria-activedescendant', current.id);
      else input.removeAttribute('aria-activedescendant');
    }
    current?.scrollIntoView?.({ block: 'nearest' });
  });

  const count = () => host()?.querySelectorAll(OPTION).length ?? 0;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const n = count();
      if (n) setActive((a) => (Math.min(a, n - 1) + (event.key === 'ArrowDown' ? 1 : n - 1)) % n);
    } else if (event.key === 'Escape' && inline) {
      onClose();
    } else if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
      const option = host()?.querySelectorAll<HTMLElement>(OPTION)[active];
      if (option) {
        event.preventDefault();
        option.click();
      }
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    const option = (event.target as HTMLElement).closest(OPTION);
    const container = host();
    if (!option || !container) return;
    const index = [...container.querySelectorAll(OPTION)].indexOf(option);
    if (index >= 0 && index !== active) setActive(index);
  };

  if (!open) return null;
  const panel =
    'w-190 max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-dialog border-0 bg-sf p-0 text-13 text-tx shadow-modal';
  const content = <CommandContext.Provider value={{ listId }}>{children}</CommandContext.Provider>;
  if (inline) {
    return (
      <div
        ref={panelRef}
        role="dialog"
        aria-label={label}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        className={cx('flex', panel)}
      >
        {content}
      </div>
    );
  }
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClick={onBackdropClick}
      onKeyDown={onKeyDown}
      onPointerMove={onPointerMove}
      className={cx(
        'fixed top-24 left-1/2 m-0 -translate-x-1/2 open:flex',
        'backdrop:bg-scrim backdrop:backdrop-blur-[1.5px]',
        panel,
      )}
    >
      {content}
    </dialog>
  );
}

export interface CommandInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
}

/** 16px input after the 9px AI dot, with the esc key hint; 14px 16px over a br2 rule. */
export function CommandInput({
  value,
  onValueChange,
  placeholder = 'Search, or tell Bemmoly what to do…',
  ...rest
}: CommandInputProps) {
  const { listId } = useCommandContext();
  return (
    <div className="flex items-center gap-2.5 border-b border-br2 px-4 py-3.5">
      <AiDot size={9} />
      <input
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={placeholder}
        autoFocus
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent px-0.5 py-px font-sans text-16 text-tx outline-0 placeholder:text-tx5"
        {...rest}
      />
      <kbd className="rounded-xs border border-br px-1.5 py-0.5 font-mono text-11 font-medium text-tx5">
        esc
      </kbd>
    </div>
  );
}

export interface CommandScopesProps<V extends string> {
  scopes: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  /** Right side, e.g. "in Platform Core · everywhere". */
  context?: ReactNode;
}

/** Scope chips: 12px, 4px 10px pills; the chosen one is accent on ac-bg. */
export function CommandScopes<V extends string>({
  scopes,
  value,
  onChange,
  context,
}: CommandScopesProps<V>) {
  return (
    <div className="flex items-center gap-1.5 border-b border-br2 px-4 py-2.5 text-12">
      <div role="group" aria-label="Search in" className="flex gap-1.5">
        {scopes.map((scope) => {
          const on = scope.value === value;
          return (
            <button
              key={scope.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(scope.value)}
              className={cx(
                'cursor-pointer rounded-dialog border px-2.5 py-1 font-sans text-12 font-medium',
                on ? 'border-ac bg-ac-bg text-ac' : 'border-br bg-sf text-tx2',
                focusRing,
              )}
            >
              {scope.label}
            </button>
          );
        })}
      </div>
      {context && <span className="ml-auto text-tx5">{context}</span>}
    </div>
  );
}

export interface CommandFooterProps {
  hints?: readonly { keys: string; label: string }[];
  /** Right side, e.g. example queries. */
  extra?: ReactNode;
}

const DEFAULT_HINTS = [
  { keys: '↑↓', label: 'navigate' },
  { keys: '⏎', label: 'open' },
  { keys: '⌘⏎', label: 'run' },
];

/** Key hints on the sf2 bar: mono 11px keys in a bordered chip. */
export function CommandFooter({ hints = DEFAULT_HINTS, extra }: CommandFooterProps) {
  return (
    <div className="flex items-center gap-3.5 border-t border-br2 bg-sf2 px-4 py-2.5 text-12 text-tx5">
      {hints.map((hint) => (
        <span key={hint.keys}>
          <kbd className="rounded-chip border border-br bg-sf px-1.25 py-px font-mono text-11 font-medium text-tx4">
            {hint.keys}
          </kbd>{' '}
          {hint.label}
        </span>
      ))}
      {extra && <span className="ml-auto">{extra}</span>}
    </div>
  );
}
