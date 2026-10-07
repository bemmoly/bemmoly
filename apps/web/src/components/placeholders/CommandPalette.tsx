import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { KeyChip } from './KeyChip.tsx';

/**
 * PLACEHOLDER for @bemmoly/ui CommandPalette, measured from the Command mock:
 * a 760px panel 96px from the top over a blurred, dimmed page.
 */
export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  activeDescendant?: string;
  listId: string;
  scopes: ReactNode;
  footerAside?: ReactNode;
  children: ReactNode;
}

export function CommandPalette({
  open,
  onClose,
  query,
  onQueryChange,
  onKeyDown,
  activeDescendant,
  listId,
  scopes,
  footerAside,
  children,
}: CommandPaletteProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-scrim backdrop-blur-[1.5px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
        className="absolute top-24 left-1/2 flex w-190 max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-dialog bg-sf shadow-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-br2 px-4 py-3.5">
          <span className="size-2.25 shrink-0 rounded-full bg-ac" aria-hidden="true" />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeDescendant}
            aria-label="Search, or tell Bemmoly what to do"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              else onKeyDown(event);
            }}
            placeholder="Search, or tell Bemmoly what to do…"
            className="flex-1 border-0 bg-transparent font-sans text-lead text-tx outline-none placeholder:text-tx5"
          />
          <KeyChip>esc</KeyChip>
        </div>
        <div className="flex gap-1.5 border-b border-br2 px-4 py-2.5 text-caption">{scopes}</div>
        {children}
        <div className="flex items-center gap-3.5 border-t border-br2 bg-head-bg px-4 py-2.5 text-caption text-tx5">
          <span>
            <KeyChip variant="hint">↑↓</KeyChip> navigate
          </span>
          <span>
            <KeyChip variant="hint">⏎</KeyChip> open
          </span>
          <span>
            <KeyChip variant="hint">⌘⏎</KeyChip> run
          </span>
          {footerAside ? <span className="ml-auto">{footerAside}</span> : null}
        </div>
      </div>
    </div>
  );
}
