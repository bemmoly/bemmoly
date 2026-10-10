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
import { useEffect, useRef } from 'react';
import type { IssueQuickActions } from '../hooks/issue-quick-actions.ts';
import type { MenuSprint } from './issue-actions-menu.tsx';

export interface IssueBulkBarProps {
  /** The selected issues' keys, in screen order. */
  keys: readonly string[];
  meId: string | undefined;
  /** Where a selection can move: sprints and the Backlog (`id: null`). Leave out to hide Move to. */
  sprints?: readonly MenuSprint[];
  actions: IssueQuickActions;
  onClear: () => void;
  /** Whether Esc belongs to something else right now, such as a drag in flight. */
  holdEscape?: () => boolean;
}

const ORDER: readonly Priority[] = ['highest', 'high', 'medium', 'low', 'lowest'];

const trigger = (label: string, icon: IconName) =>
  function BulkTrigger(props: MenuTriggerProps) {
    return (
      <Button {...props} size="xs" variant="ghost" icon={<Icon name={icon} size={14} />}>
        {label}
      </Button>
    );
  };

const PriorityTrigger = trigger('Priority', 'flag');
const MoveTrigger = trigger('Move to', 'sprint');

/**
 * What a selection on the Backlog or the Board can do at once: assign, priority, move to a
 * sprint, delete with Undo. Esc clears the selection, unless a menu, a field or a drag has the
 * key.
 */
export function IssueBulkBar({
  keys,
  meId,
  sprints,
  actions,
  onClear,
  holdEscape,
}: IssueBulkBarProps) {
  const count = keys.length;
  const live = useRef({ onClear, holdEscape });
  useEffect(() => {
    live.current = { onClear, holdEscape };
  });
  useEffect(() => {
    if (count === 0) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (live.current.holdEscape?.()) return;
      live.current.onClear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  return (
    <BulkBar count={count} onClear={onClear}>
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
      <Menu trigger={PriorityTrigger}>
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
      {sprints && sprints.length > 0 && (
        <Menu trigger={MoveTrigger}>
          {sprints.map((sprint) => (
            <MenuItem
              key={sprint.id ?? 'backlog'}
              icon={<Icon name={sprint.id ? 'target' : 'backlog'} size={14} />}
              onSelect={() =>
                void actions.update(
                  keys,
                  { sprintId: sprint.id },
                  `Moved ${count} to ${sprint.name}`,
                )
              }
            >
              {sprint.name}
            </MenuItem>
          ))}
        </Menu>
      )}
      <Button
        size="xs"
        variant="ghost"
        icon={<Icon name="trash" size={14} />}
        className="text-red-tx"
        onClick={() => {
          actions.remove(keys);
          onClear();
        }}
      >
        Delete
      </Button>
    </BulkBar>
  );
}
