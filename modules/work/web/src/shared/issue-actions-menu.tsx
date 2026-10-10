import {
  IconButton,
  Menu,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  PRIORITIES,
  PriorityGlyph,
  type Priority,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { IssueQuickActions } from '../hooks/issue-quick-actions.ts';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';

/*
 * The one menu for an issue on a list screen: the card's and the row's ···, and the same menu
 * on right-click. Everything a hover tool does is here too, so the keyboard and touch reach it.
 */

export interface MenuSprint {
  id: string | null;
  name: string;
}

export interface IssueActionsMenuProps {
  issueKey: string;
  assigneeId: string | null;
  priority: Priority;
  sprintId?: string | null;
  meId: string | undefined;
  actions: IssueQuickActions;
  onOpen: () => void;
  /** Sprints it can move to; the Backlog appears as `id: null`. Leave out to hide the group. */
  sprints?: readonly MenuSprint[];
  /** The keys the menu acts on: the selection when this issue is part of one. */
  targets?: readonly string[];
}

const ORDER: readonly Priority[] = ['highest', 'high', 'medium', 'low', 'lowest'];

/** The attribute the right-click handler finds the menu trigger by. */
export const ROW_MENU = 'data-row-menu';

/** Right-click opens the item's own ··· menu at its trigger. */
export function openRowMenu(event: React.MouseEvent<HTMLElement>): void {
  const trigger = event.currentTarget.querySelector<HTMLButtonElement>(`[${ROW_MENU}]`);
  if (!trigger) return;
  event.preventDefault();
  trigger.click();
}

export function IssueActionsMenu({
  issueKey,
  assigneeId,
  priority,
  sprintId,
  meId,
  actions,
  onOpen,
  sprints,
  targets,
}: IssueActionsMenuProps) {
  const keys = targets && targets.length > 1 ? targets : [issueKey];
  const many = keys.length > 1;
  const mine = meId !== undefined && assigneeId === meId;
  return (
    <Menu
      align="end"
      trigger={(props) => (
        <IconButton
          {...props}
          {...{ [ROW_MENU]: '' }}
          size="tool"
          label={many ? `Actions for ${keys.length} issues` : `Actions for ${issueKey}`}
          icon="more"
          onClick={(event) => {
            event.stopPropagation();
            props.onClick();
          }}
        />
      )}
    >
      {!many && (
        <>
          <MenuItem icon={<Icon name="expand" size={14} />} hint="Enter" onSelect={onOpen}>
            Open
          </MenuItem>
          <MenuItem
            icon={<Icon name="link" size={14} />}
            onSelect={() => navigateTo(workPaths.issue(issueKey))}
          >
            Open full page
          </MenuItem>
          <MenuItem
            icon={<Icon name="copy" size={14} />}
            onSelect={() =>
              void navigator.clipboard?.writeText(
                `${window.location.origin}${workPaths.issue(issueKey)}`,
              )
            }
          >
            Copy link
          </MenuItem>
          <MenuSeparator />
        </>
      )}
      {meId && (
        <MenuItem
          icon={<Icon name="user" size={14} />}
          hint="I"
          onSelect={() => void actions.update(keys, { assigneeId: mine && !many ? null : meId })}
        >
          {mine && !many ? 'Unassign' : 'Assign to me'}
        </MenuItem>
      )}
      <MenuGroup label="Priority" separated>
        {ORDER.map((level) => (
          <MenuItem
            key={level}
            icon={<PriorityGlyph priority={level} />}
            {...(many ? {} : { checked: level === priority })}
            onSelect={() => void actions.update(keys, { priority: level })}
          >
            {PRIORITIES[level].name}
          </MenuItem>
        ))}
      </MenuGroup>
      {sprints && sprints.length > 0 && (
        <MenuGroup label="Move to" separated>
          {sprints
            .filter((sprint) => many || sprint.id !== (sprintId ?? null))
            .map((sprint) => (
              <MenuItem
                key={sprint.id ?? 'backlog'}
                icon={<Icon name={sprint.id ? 'target' : 'backlog'} size={14} />}
                onSelect={() =>
                  void actions.update(keys, { sprintId: sprint.id }, `Moved to ${sprint.name}`)
                }
              >
                {sprint.name}
              </MenuItem>
            ))}
        </MenuGroup>
      )}
      <MenuSeparator />
      <MenuItem
        tone="danger"
        icon={<Icon name="trash" size={14} />}
        hint="Delete"
        onSelect={() => actions.remove(keys)}
      >
        {many ? `Delete ${keys.length} issues` : 'Delete issue'}
      </MenuItem>
    </Menu>
  );
}
