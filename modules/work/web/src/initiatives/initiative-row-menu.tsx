import type { Initiative } from '@bemmoly/module-work/shared';
import { IconButton, Menu, MenuItem, MenuSeparator, rowReveal } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { SyntheticEvent } from 'react';

/** The row opens the program; the menu's own clicks, portal included, stay out of the row. */
const contain = (event: SyntheticEvent) => event.stopPropagation();

export interface InitiativeRowMenuProps {
  initiative: Initiative;
  onOpen: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

/** The ··· at the end of an initiative row: Open, then Edit and Archive for people who manage. */
export function InitiativeRowMenu({
  initiative,
  onOpen,
  onEdit,
  onArchive,
}: InitiativeRowMenuProps) {
  const archived = initiative.archivedAt !== null;
  const icon = (name: Parameters<typeof Icon>[0]['name']) => (
    <Icon name={name} size={15} className="text-tx-3" />
  );
  const hint = initiative.canManage ? undefined : 'Managers only';
  return (
    <span className="contents" onClick={contain} onKeyDown={contain}>
      <Menu
        align="end"
        widthClassName="w-52"
        trigger={(props) => (
          <IconButton
            {...props}
            data-row-menu=""
            label={`Actions for ${initiative.name}`}
            icon="more"
            size="xs"
            className={rowReveal}
          />
        )}
      >
        <MenuItem icon={icon('roadmap')} onSelect={onOpen}>
          Open timeline
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={icon('settings')}
          disabled={!initiative.canManage || archived}
          hint={hint}
          onSelect={onEdit}
        >
          Edit
        </MenuItem>
        <MenuItem
          icon={icon('archive')}
          disabled={!initiative.canManage}
          hint={hint}
          onSelect={onArchive}
        >
          {archived ? 'Unarchive' : 'Archive'}
        </MenuItem>
      </Menu>
    </span>
  );
}
