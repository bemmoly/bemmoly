import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { cx } from '../../lib/cx.ts';
import { MenuContext } from './menu-context.ts';

export interface MenuTriggerProps {
  ref: Ref<HTMLButtonElement>;
  id: string;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
}

export interface MenuProps {
  /** Renders the button that opens the menu; spread the props onto it. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  /** Start open, e.g. to show the menu in a story or a screenshot. */
  defaultOpen?: boolean;
  /** Tailwind width class; the Doc Editor menu is 320px (w-80). */
  widthClassName?: string;
  className?: string;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

/**
 * The popover menu of the Doc Editor: 8px radius, br border, shadow-menu, 6px padding. Arrow
 * keys, Home and End move between items, Enter and Space choose, Escape closes and returns
 * focus to the trigger, Tab and a click outside close.
 */
export function Menu({
  trigger,
  children,
  align = 'start',
  widthClassName = 'w-80',
  defaultOpen = false,
  className,
}: MenuProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [focusLast, setFocusLast] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const menuId = useId();

  const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])];

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const list = items();
    (focusLast ? list.at(-1) : list[0])?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, focusLast, close]);

  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusLast(event.key === 'ArrowUp');
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') close(false);
  };

  return (
    <div ref={rootRef} className={cx('relative inline-flex', className)}>
      {trigger({
        ref: triggerRef,
        id: triggerId,
        onClick: () => {
          setFocusLast(false);
          setOpen((value) => !value);
        },
        onKeyDown: onTriggerKeyDown,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
      })}
      {open && (
        <MenuContext.Provider value={{ close }}>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            className={cx(
              'absolute top-full z-50 mt-1 flex flex-col rounded-card border border-br bg-sf p-1.5 text-13 text-tx shadow-menu',
              align === 'end' ? 'right-0' : 'left-0',
              widthClassName,
            )}
          >
            {children}
          </div>
        </MenuContext.Provider>
      )}
    </div>
  );
}
