import type { ProjectMember } from '@bemmoly/module-work/shared';
import { Button, Menu, MenuItem, type SelectOption } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';

const LAST_ADMIN = 'A project keeps at least one project admin.';

/**
 * The project role as a quiet ghost button that opens a menu (the review's Members tab):
 * a full select in every row made a calm table busy. Without permission it is plain text.
 */
export function MemberRole({
  member,
  options,
  canManage,
  locked,
  onChange,
}: {
  member: ProjectMember;
  options: readonly SelectOption[];
  canManage: boolean;
  locked: boolean;
  onChange: (member: ProjectMember, roleId: string) => void;
}) {
  if (!canManage || locked)
    return (
      <span className="px-2.5 text-13 text-tx-2" title={locked ? LAST_ADMIN : undefined}>
        {member.roleName}
      </span>
    );
  return (
    <Menu
      widthClassName="w-52"
      trigger={(props) => (
        <Button
          {...props}
          variant="ghost"
          size="xs"
          className="shadow-[inset_0_0_0_1px_var(--line)]"
          aria-label={`Project role for ${member.name}: ${member.roleName}`}
          iconEnd={<Icon name="caret" size={13} className="text-tx-3" />}
        >
          {member.roleName}
        </Button>
      )}
    >
      {options.map((option) => (
        <MenuItem
          key={option.value}
          checked={option.value === member.roleId}
          onSelect={() => option.value !== member.roleId && onChange(member, option.value)}
        >
          {option.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
