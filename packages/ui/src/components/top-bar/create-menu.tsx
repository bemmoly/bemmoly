import type { ReactNode } from 'react';
import { Icon, ICON_SIZE, type IconName } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { useMenu } from '../menu/menu-context.ts';

export interface CreateMenuItemProps {
  icon: IconName;
  label: string;
  /** One line saying what gets made and where. */
  description: string;
  /** A keyboard shortcut, shown as a key chip ("⌘ N" in the Command mock). */
  shortcut?: string;
  onSelect: () => void;
}

const tile = 'flex size-8 shrink-0 items-center justify-center rounded-control bg-bg2 text-tx2';

/** One thing Create can make: icon tile, label, a one-line description and its shortcut. */
export function CreateMenuItem({
  icon,
  label,
  description,
  shortcut,
  onSelect,
}: CreateMenuItemProps) {
  const { close } = useMenu();
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={() => {
        onSelect();
        close();
      }}
      className={cx(
        'group flex w-full cursor-pointer items-center gap-3 rounded-sm border-0 bg-transparent px-2.5 py-2 text-left font-sans outline-0',
        'hover:bg-bg2 focus:bg-ac-bg',
      )}
    >
      <span className={cx(tile, 'group-focus:bg-sf group-focus:text-ac')}>
        <Icon name={icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-13 font-medium text-tx group-focus:text-ac">{label}</span>
        <span className="text-12 leading-note text-tx5">{description}</span>
      </span>
      {shortcut ? (
        <kbd className="shrink-0 rounded-sm border border-br3 bg-sf px-1.5 py-0.5 font-mono text-11 font-medium text-tx4">
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
}

export interface CreateMenuEmptyProps {
  title: string;
  description: ReactNode;
  /** A next step, such as a menu item that opens Settings › Modules for admins. */
  action?: ReactNode;
}

/** What Create shows while no enabled module makes anything. */
export function CreateMenuEmpty({ title, description, action }: CreateMenuEmptyProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3 px-2.5 pt-2 pb-1">
        <span className={tile}>
          <Icon name="modules" size={ICON_SIZE.bar} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-13 font-semibold text-tx">{title}</span>
          <span className="text-12h leading-body text-tx4">{description}</span>
        </div>
      </div>
      {action ? <div className="border-t border-br-row pt-1">{action}</div> : null}
    </div>
  );
}
