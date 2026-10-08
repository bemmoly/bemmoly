import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
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
 * Menu. The caret is tx4, one step darker than the mock, so it reads on every theme.
 */
export function Dropdown({ label, buttonProps, ...menu }: DropdownProps) {
  return (
    <Menu
      {...menu}
      trigger={(props) => (
        <Button
          tight
          iconEnd={<Icon name="caret" className="text-tx4" />}
          {...buttonProps}
          {...props}
        >
          {label}
        </Button>
      )}
    />
  );
}
