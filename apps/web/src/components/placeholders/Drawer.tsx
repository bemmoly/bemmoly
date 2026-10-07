import { useEffect, useId, type ReactNode } from 'react';

/** PLACEHOLDER for @bemmoly/ui Drawer: a right-hand panel under the top bar (inbox, module access). */
export interface DrawerProps {
  open: boolean;
  title: ReactNode;
  label: string;
  onClose: () => void;
  aside?: ReactNode;
  children: ReactNode;
}

export function Drawer({ open, title, label, onClose, aside, children }: DrawerProps) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 top-topbar bottom-0 z-40" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-label={label}
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        className="absolute top-0 right-0 bottom-0 flex w-105 flex-col border-l border-br bg-sf shadow-menu"
      >
        <div className="flex items-center gap-2 border-b border-br2 px-4 py-3">
          <h2 id={titleId} className="m-0 flex items-center text-base font-semibold text-tx">
            {title}
          </h2>
          <div className="ml-auto flex items-center gap-3">
            {aside}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="cursor-pointer border-0 bg-transparent p-1 text-tx5 hover:text-tx"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </aside>
    </div>
  );
}
