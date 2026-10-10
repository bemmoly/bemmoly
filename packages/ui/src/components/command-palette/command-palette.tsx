import { Kbd } from '../kbd/kbd.tsx';
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
import { Icon } from '../../icons/icon.tsx';
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
  /** Tab (and Shift+Tab) moves between the type filters instead of leaving the input. */
  onTab?: (backwards: boolean) => void;
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
  onTab,
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
    } else if (event.key === 'Tab' && onTab) {
      event.preventDefault();
      setActive(0);
      onTab(event.shiftKey);
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
    'w-165 max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-dialog border-0 bg-card p-0 text-13 text-tx shadow-e3';
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
        'fixed top-[min(110px,12vh)] left-1/2 m-0 -translate-x-1/2 open:flex',
        'backdrop:bg-scrim',
        'motion-safe:animate-dialog-in backdrop:motion-safe:animate-fade-in',
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
  /** AI is on: the lilac dot leads the input, which also takes requests. */
  ai?: boolean;
}

/**
 * The 54px input row (docs/design/premium/screens.js, `screenPalette`): the search icon, or the
 * AI dot when AI is on, then a 15px input and the Esc hint.
 */
export function CommandInput({
  value,
  onValueChange,
  ai = false,
  placeholder = ai ? 'Search, or tell Bemmoly what to do…' : 'Search or run a command…',
  ...rest
}: CommandInputProps) {
  const { listId } = useCommandContext();
  return (
    <div className="flex h-13.5 shrink-0 items-center gap-2.5 border-b border-line px-4.5">
      {ai ? <AiDot size={9} /> : <Icon name="search" size={18} className="text-tx-3" />}
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
        className="min-w-0 flex-1 border-0 bg-transparent px-0.5 py-px font-sans text-16 text-tx outline-0 placeholder:text-tx-3"
        {...rest}
      />
      <Kbd keys="Esc" />
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
    <div className="flex items-center gap-1.5 border-b border-line px-3.5 py-1.5 text-12">
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
                'h-6 cursor-pointer rounded-full border-0 px-2.5 font-sans text-12 font-medium',
                on ? 'bg-acc-50 text-acc' : 'bg-transparent text-tx-2 hover:bg-hover',
                focusRing,
              )}
            >
              {scope.label}
            </button>
          );
        })}
      </div>
      {context && <span className="ml-auto text-tx-3">{context}</span>}
    </div>
  );
}

export interface CommandFooterProps {
  hints?: readonly { keys: string; label: string }[];
  /** Right side, e.g. example queries. */
  extra?: ReactNode;
}

const DEFAULT_HINTS = [
  { keys: 'Up Down', label: 'move' },
  { keys: 'Enter', label: 'open' },
  { keys: 'Tab', label: 'filter by type' },
];

/**
 * Key hints on the 38px footer bar, each a Kbd chip and its action, teaching the keyboard. A
 * phone has no keyboard to teach, so the bar is left out there.
 */
export function CommandFooter({ hints = DEFAULT_HINTS, extra }: CommandFooterProps) {
  return (
    <div className="hidden h-9.5 shrink-0 items-center sm:flex gap-3.5 border-t border-line bg-sunken px-4 text-12 text-tx-3">
      {hints.map((hint) => (
        <span key={hint.keys} className="inline-flex items-center gap-1.5">
          <Kbd keys={hint.keys} />
          {hint.label}
        </span>
      ))}
      {extra && <span className="ml-auto">{extra}</span>}
    </div>
  );
}
