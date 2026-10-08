import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { caretTone } from '../../lib/focus.ts';
import { Button, type ButtonProps } from '../button/button.tsx';
import { Menu, type MenuProps } from './menu.tsx';

export interface DropdownProps extends Omit<MenuProps, 'trigger'> {
  /** The trigger text, e.g. "Epic". */
  label: ReactNode;
  /** Extra props for the trigger button. */
  buttonProps?: Omit<ButtonProps, 'children'>;
}

/**
 * The filter trigger of the Board and Backlog ("Epic ▾": 32px, 10px padding, tx2) opening a
 * Menu. The caret is a 16px chevron in tx4 that darkens while the menu is open or focused;
 * the mock's 10px ▾ disappears on most themes.
 */
export function Dropdown({ label, buttonProps, ...menu }: DropdownProps) {
  return (
    <Menu
      {...menu}
      trigger={(props) => (
        <Button
          tight
          iconEnd={<Icon name="caret" className={caretTone} />}
          {...buttonProps}
          {...props}
          className={cx('group', buttonProps?.className)}
        >
          {label}
        </Button>
      )}
    />
  );
}
