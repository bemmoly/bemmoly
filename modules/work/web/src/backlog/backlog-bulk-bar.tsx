import {
  Button,
  BulkBar,
  Menu,
  MenuItem,
  PRIORITIES,
  PriorityGlyph,
  type MenuTriggerProps,
  type Priority,
} from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { useEffect } from 'react';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import { EMPTY_SELECTION } from '../hooks/issue-selection.ts';
import type { IssueQuickActions } from '../hooks/issue-quick-actions.ts';
import type { MenuSprint } from '../shared/issue-actions-menu.tsx';

export interface BacklogBulkBarProps {
  /** The selected rows' keys, in screen order. */
  keys: readonly string[];
  meId: string | undefined;
  sprints: readonly MenuSprint[];
  actions: IssueQuickActions;
}

const ORDER: readonly Priority[] = ['highest', 'high', 'medium', 'low', 'lowest'];

const clear = () => useBacklogUi.getState().setSelection(EMPTY_SELECTION);

/**
 * What a selection can do at once: assign, priority, move to a sprint, delete with Undo. Esc
 * clears the selection, unless a menu or a field has the key.
 */
export function BacklogBulkBar({ keys, meId, sprints, actions }: BacklogBulkBarProps) {
  const count = keys.length;
  useEffect(() => {
    if (count === 0) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (useBacklogUi.getState().drag) return;
      clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  const trigger = (label: string, icon: IconName) =>
    function BulkTrigger(props: MenuTriggerProps) {
      return (
        <Button {...props} size="xs" variant="ghost" icon={<Icon name={icon} size={14} />}>
          {label}
        </Button>
      );
    };

  return (
    <BulkBar count={count} onClear={clear}>
      {meId && (
        <Button
          size="xs"
          variant="ghost"
          icon={<Icon name="user" size={14} />}
          onClick={() =>
            void actions.update(keys, { assigneeId: meId }, `Assigned ${count} to you`)
          }
        >
          Assign to me
        </Button>
      )}
      <Menu trigger={trigger('Priority', 'flag')}>
        {ORDER.map((level) => (
          <MenuItem
            key={level}
            icon={<PriorityGlyph priority={level} />}
            onSelect={() => void actions.update(keys, { priority: level })}
          >
            {PRIORITIES[level].name}
          </MenuItem>
        ))}
      </Menu>
      <Menu trigger={trigger('Move to', 'sprint')}>
        {sprints.map((sprint) => (
          <MenuItem
            key={sprint.id ?? 'backlog'}
            icon={<Icon name={sprint.id ? 'target' : 'backlog'} size={14} />}
            onSelect={() =>
              void actions.update(keys, { sprintId: sprint.id }, `Moved ${count} to ${sprint.name}`)
            }
          >
            {sprint.name}
          </MenuItem>
        ))}
      </Menu>
      <Button
        size="xs"
        variant="ghost"
        icon={<Icon name="trash" size={14} />}
        className="text-red-tx"
        onClick={() => {
          actions.remove(keys);
          clear();
        }}
      >
        Delete
      </Button>
    </BulkBar>
  );
}
