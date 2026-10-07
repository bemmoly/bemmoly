import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { useDialog } from '../../lib/use-dialog.ts';
import { IconButton } from '../button/icon-button.tsx';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Names the panel for assistive tech, e.g. "PLT-204 details". */
  label: string;
  /** Left side of the header bar: the epic / type / key trail in the Board mock. */
  header?: ReactNode;
  /** Header actions before the close button (⤢ open full page, ··· more). */
  actions?: ReactNode;
  children: ReactNode;
  /**
   * docked: the Board's issue panel, a 400px column beside the content (the mock).
   * overlay: the same panel over a scrim, for narrow screens and pages without room.
   */
  variant?: 'docked' | 'overlay';
  className?: string;
}

function Panel({
  header,
  actions,
  onClose,
  children,
}: Pick<DrawerProps, 'header' | 'actions' | 'onClose' | 'children'>) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-br2 px-4 py-3 text-12h text-tx4">
        <div className="flex min-w-0 items-center gap-2">{header}</div>
        <div className="ml-auto flex items-center gap-1 font-semibold text-tx2">
          {actions}
          <IconButton label="Close" icon="close" size="xs" onClick={onClose} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4.5 overflow-auto px-5 pt-4 pb-6">
        {children}
      </div>
    </>
  );
}

/** Header bar 12px 16px over a br2 rule; body 16px 20px 24px with 18px between blocks. */
export function Drawer({
  open,
  onClose,
  label,
  header,
  actions,
  children,
  variant = 'docked',
  className,
}: DrawerProps) {
  const { ref, onBackdropClick } = useDialog(open && variant === 'overlay', onClose);
  if (!open) return null;
  if (variant === 'overlay') {
    return (
      <dialog
        ref={ref}
        aria-label={label}
        onClick={onBackdropClick}
        className={cx(
          'm-0 ml-auto h-full max-h-full w-100 max-w-full flex-col border-0 border-l border-br bg-sf p-0 text-13 text-tx open:flex',
          'backdrop:bg-scrim',
          className,
        )}
      >
        <Panel header={header} actions={actions} onClose={onClose}>
          {children}
        </Panel>
      </dialog>
    );
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };
  return (
    <aside
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx(
        'flex min-h-0 w-100 shrink-0 flex-col border-l border-br bg-sf text-13 text-tx',
        className,
      )}
    >
      <Panel header={header} actions={actions} onClose={onClose}>
        {children}
      </Panel>
    </aside>
  );
}

/** The issue title at the top of the drawer body: 18px semibold, 1.3 line height. */
export function DrawerTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cx(
        'm-0 text-18 leading-title font-semibold tracking-brand text-pretty',
        className,
      )}
    >
      {children}
    </h2>
  );
}
