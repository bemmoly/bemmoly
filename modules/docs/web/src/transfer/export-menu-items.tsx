import type { PageDetail } from '@bemmoly/module-docs/shared';
import { MenuGroup, MenuItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useExportActions } from './use-export-actions.ts';

/** The More menu's Export group: one row per format, with the file type as the hint. */
export function ExportMenuItems({ page }: { page: PageDetail }) {
  const actions = useExportActions(page);
  if (actions.length === 0) return null;
  return (
    <MenuGroup label="Export" separated>
      {actions.map((action) => (
        <MenuItem
          key={action.id}
          icon={<Icon name="download" size={14} />}
          hint={action.hint}
          onSelect={action.run}
        >
          {action.label}
        </MenuItem>
      ))}
    </MenuGroup>
  );
}
