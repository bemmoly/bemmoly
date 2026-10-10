import { Button, Menu, MenuItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';

export interface RoleChoice {
  value: string;
  label: string;
}

interface RoleMenuProps {
  /** Whose role this is, for the button's accessible name. */
  person: string;
  value: string;
  options: readonly RoleChoice[];
  disabled?: boolean;
  /** Why it is disabled, shown on hover. */
  reason?: string;
  onChange: (roleId: string) => void;
}

/**
 * The review's quiet inline role control: a ghost button naming the role that opens a menu of
 * roles, the current one checked. A table of bordered selects reads busy; this reads as text
 * until it is needed.
 */
export function RoleMenu({ person, value, options, disabled, reason, onChange }: RoleMenuProps) {
  const current = options.find((option) => option.value === value)?.label ?? 'No role';
  if (disabled) {
    return (
      <span className="truncate px-2 text-tx-2" title={reason}>
        {current}
      </span>
    );
  }
  return (
    <Menu
      widthClassName="w-56"
      trigger={(props) => (
        <Button
          {...props}
          variant="ghost"
          size="sm"
          tight
          aria-label={`Role for ${person}: ${current}`}
          iconEnd={<Icon name="caret" size={14} className="text-tx-3" />}
          className="max-w-full shadow-[inset_0_0_0_1px_var(--line)]"
        >
          <span className="truncate">{current}</span>
        </Button>
      )}
    >
      {options.map((option) => (
        <MenuItem
          key={option.value}
          checked={option.value === value}
          onSelect={() => option.value !== value && onChange(option.value)}
        >
          {option.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
