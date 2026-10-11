import { Button, Menu, MenuGroup, MenuItem, MenuSeparator, Tooltip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { DISPLAY_FIELDS, type BoardDisplayApi, type DisplayField } from '../hooks/board-display.ts';

export interface BoardDisplayMenuProps {
  display: BoardDisplayApi;
  /** Kanban cards show the time in the column where Scrum cards show points. */
  kanban: boolean;
}

const FIELD_NAMES: Record<DisplayField, string> = {
  key: 'Key',
  priority: 'Priority',
  estimate: 'Points',
  age: 'Time in column',
  assignee: 'Assignee',
  labels: 'Labels',
  blocked: 'Blocked by',
  docs: 'Linked doc',
  subtasks: 'Subtasks',
};

/**
 * Display, at the end of the Board's filter row: this person's card fields, density and empty
 * columns for this board. Every item keeps the menu open, so a few changes are one visit; the
 * board changes behind it as they are made. A dot on the button says the view is not the
 * board's own, and Reset brings it back.
 */
export function BoardDisplayMenu({ display, kanban }: BoardDisplayMenuProps) {
  const fields = DISPLAY_FIELDS.filter((field) => field !== (kanban ? 'estimate' : 'age'));
  const { shown, display: current } = display;
  return (
    <Menu
      align="end"
      widthClassName="w-60 max-h-[min(520px,75vh)] overflow-y-auto"
      trigger={(props) => (
        <Tooltip label="Card fields, density and empty columns">
          <Button {...props} size="sm" icon={<Icon name="sliders" size={14} />}>
            Display
            {display.customized && (
              <>
                <span aria-hidden className="size-1.5 rounded-full bg-acc" />
                <span className="sr-only">(changed from the board's default)</span>
              </>
            )}
          </Button>
        </Tooltip>
      )}
    >
      <MenuGroup label="Card fields">
        {fields.map((field) => (
          <MenuItem
            key={field}
            kind="checkbox"
            keepOpen
            checked={shown.has(field)}
            onSelect={() => display.setField(field, !shown.has(field))}
          >
            {FIELD_NAMES[field]}
          </MenuItem>
        ))}
      </MenuGroup>
      <MenuGroup label="Density" separated>
        <MenuItem
          keepOpen
          checked={current.density === 'comfortable'}
          onSelect={() => display.setDensity('comfortable')}
        >
          Comfortable
        </MenuItem>
        <MenuItem
          keepOpen
          checked={current.density === 'compact'}
          onSelect={() => display.setDensity('compact')}
        >
          Compact
        </MenuItem>
      </MenuGroup>
      <MenuGroup label="Columns" separated>
        <MenuItem
          kind="checkbox"
          keepOpen
          checked={current.showEmptyColumns}
          onSelect={() => display.setShowEmptyColumns(!current.showEmptyColumns)}
        >
          Show empty columns
        </MenuItem>
      </MenuGroup>
      {display.customized && (
        <>
          <MenuSeparator />
          <MenuItem icon={<Icon name="undo" size={14} />} onSelect={display.reset}>
            Reset to the board's default
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
