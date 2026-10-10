import type { Project } from '@bemmoly/module-work/shared';
import { IconButton, Menu, MenuItem, MenuSeparator, rowReveal } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { SyntheticEvent } from 'react';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { projectPaths } from './project-paths.ts';

/** The row opens the board; the menu's own clicks, portal included, stay out of the row. */
const contain = (event: SyntheticEvent) => event.stopPropagation();

export interface ProjectRowMenuProps {
  project: Project;
  starred: boolean;
  canArchive: boolean;
  onStar: () => void;
  onArchive: () => void;
}

/**
 * The ··· at the end of a project row or card, also opened by right-clicking the row: every
 * place a project leads, then Star and Archive (Unarchive for an archived one).
 */
export function ProjectRowMenu({
  project,
  starred,
  canArchive,
  onStar,
  onArchive,
}: ProjectRowMenuProps) {
  const archived = project.archivedAt !== null;
  const go = (path: string) => () => navigateTo(path);
  const icon = (name: Parameters<typeof Icon>[0]['name']) => (
    <Icon name={name} size={15} className="text-tx-3" />
  );
  return (
    <span className="contents" onClick={contain} onKeyDown={contain}>
      <Menu
        align="end"
        widthClassName="w-52"
        trigger={(props) => (
          <IconButton
            {...props}
            data-row-menu=""
            label={`Actions for ${project.name}`}
            icon="more"
            size="xs"
            className={rowReveal}
          />
        )}
      >
        {!archived && (
          <>
            <MenuItem icon={icon('board')} onSelect={go(workPaths.board(project.key))}>
              Board
            </MenuItem>
            {project.method === 'scrum' && (
              <MenuItem icon={icon('backlog')} onSelect={go(projectPaths.backlog(project.key))}>
                Backlog
              </MenuItem>
            )}
          </>
        )}
        <MenuItem icon={icon('gear')} onSelect={go(projectPaths.settings(project.key))}>
          Settings
        </MenuItem>
        <MenuItem icon={icon('people')} onSelect={go(projectPaths.members(project.key))}>
          Members
        </MenuItem>
        <MenuSeparator />
        {!archived && (
          <MenuItem icon={icon('star')} onSelect={onStar}>
            {starred ? 'Remove star' : 'Star'}
          </MenuItem>
        )}
        <MenuItem
          icon={icon('archive')}
          disabled={!canArchive}
          hint={canArchive ? undefined : 'Admins only'}
          onSelect={onArchive}
        >
          {archived ? 'Unarchive' : 'Archive'}
        </MenuItem>
      </Menu>
    </span>
  );
}
