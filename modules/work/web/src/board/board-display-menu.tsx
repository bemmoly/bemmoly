import { Button, Menu, MenuGroup, MenuItem, MenuSeparator, Tooltip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { BoardDisplayApi } from '../hooks/board-display.ts';
import { navigateTo } from '../hooks/issue-navigation.ts';

export interface BoardDisplayMenuProps {
  display: BoardDisplayApi;
  projectKey: string;
  /** Holds "Configure board": the menu links to the Cards tab instead of explaining it. */
  canConfigure: boolean;
}

/** Project settings › Board › Cards, where card fields, order and colour are set. */
export const cardSettingsPath = (projectKey: string) =>
  `/work/settings/${projectKey}/board?tab=cards`;

/**
 * Display, at the end of the Board's filter row. Cards look the same for everyone on the
 * project, as the board's settings draw them, so the only personal choice here is whether empty
 * columns take room. Admins get a way to the card layout; everyone else is told where it is set.
 * A dot on the button says the view is not the board's own, and Reset brings it back.
 */
export function BoardDisplayMenu({ display, projectKey, canConfigure }: BoardDisplayMenuProps) {
  return (
    <Menu
      align="end"
      widthClassName="w-64"
      trigger={(props) => (
        <Tooltip label="Empty columns and card layout">
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
      <MenuGroup label="Columns">
        <MenuItem
          kind="checkbox"
          keepOpen
          checked={display.display.showEmptyColumns}
          onSelect={() => display.setShowEmptyColumns(!display.display.showEmptyColumns)}
        >
          Show empty columns
        </MenuItem>
      </MenuGroup>
      <MenuGroup label="Cards" separated>
        {canConfigure ? (
          <MenuItem
            icon={<Icon name="gear" size={14} />}
            onSelect={() => navigateTo(cardSettingsPath(projectKey))}
          >
            Edit card layout in settings
          </MenuItem>
        ) : (
          <p className="m-0 flex gap-2 px-2.5 py-1.5 text-12 text-tx-3">
            <Icon name="lock" size={14} className="mt-px" />
            Card layout is set by project admins for everyone on this board.
          </p>
        )}
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
