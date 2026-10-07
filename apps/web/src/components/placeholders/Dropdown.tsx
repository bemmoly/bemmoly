import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** PLACEHOLDER for @bemmoly/ui Dropdown: a menu button for "Teams ▾", "Create" and the avatar. */
export interface DropdownItem {
  id: string;
  label: string;
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface DropdownProps {
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  items: readonly DropdownItem[];
  header?: ReactNode;
  align?: 'start' | 'end';
}

export function Dropdown({
  label,
  trigger,
  triggerClassName,
  items,
  header,
  align = 'start',
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`absolute top-full z-50 mt-1 flex min-w-55 flex-col rounded-card bg-sf py-1 shadow-menu ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          {header ? <div className="border-b border-br2 px-3 pt-1.5 pb-2.5">{header}</div> : null}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-1.75 text-left font-sans text-base text-tx2 outline-none hover:bg-bg2 focus:bg-ac-bg focus:text-ac disabled:cursor-not-allowed disabled:opacity-50"
            >
              {item.label}
              {item.hint ? (
                <span className="ml-auto text-caption text-tx5">{item.hint}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
