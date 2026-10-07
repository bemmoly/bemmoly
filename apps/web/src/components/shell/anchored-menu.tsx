import { Menu } from '@bemmoly/ui';
import { useEffect, type ReactNode } from 'react';

function OnUnmount({ run }: { run: () => void }) {
  useEffect(() => run, [run]);
  return null;
}

/**
 * The design system's Menu, opened from a control that is not its own trigger
 * (the TopBar's avatar exposes only a click callback). It mounts open under
 * the top bar's right edge and reports when the Menu closes itself (a choice,
 * Escape or a click outside).
 */
export function AnchoredMenu({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed top-topbar right-3 z-50">
      <Menu
        defaultOpen
        align="end"
        widthClassName="w-64"
        trigger={(props) => (
          <button type="button" className="sr-only" {...props}>
            {label}
          </button>
        )}
      >
        {children}
        <OnUnmount run={onClose} />
      </Menu>
    </div>
  );
}
