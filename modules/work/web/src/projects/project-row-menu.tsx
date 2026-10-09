import type { Project } from '@bemmoly/module-work/shared';
import { IconButton, Menu, MenuItem } from '@bemmoly/ui';
import type { SyntheticEvent } from 'react';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { membersPath } from './members-hooks.ts';

/** The row opens the board; the menu's own clicks, portal included, stay out of the row. */
const contain = (event: SyntheticEvent) => event.stopPropagation();

/** The ··· at the end of a project row. */
export function ProjectRowMenu({ project }: { project: Project }) {
  return (
    <span className="contents" onClick={contain} onKeyDown={contain}>
      <Menu
        align="end"
        widthClassName="w-48"
        trigger={(props) => (
          <IconButton
            {...props}
            label={`Actions for ${project.name}`}
            icon="more"
            size="xs"
            className="font-normal text-tx6"
          />
        )}
      >
        <MenuItem onSelect={() => navigateTo(workPaths.board(project.key))}>Open board</MenuItem>
        <MenuItem onSelect={() => navigateTo(membersPath(project.key))}>Members</MenuItem>
      </Menu>
    </span>
  );
}
