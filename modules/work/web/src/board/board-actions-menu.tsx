import type { Project } from '@bemmoly/module-work/shared';
import { IconButton, Menu, MenuItem, MenuSeparator, useToast } from '@bemmoly/ui';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { settingsPath } from '../settings/pages.ts';
import { workflowPaths } from '../workflow/navigate.ts';

export interface BoardActionsMenuProps {
  project: Project;
  boardName: string;
}

/**
 * The ··· at the end of the board header. The mock draws the button without its menu; it holds
 * the board's own pages that exist (settings and workflow) and a way to share the board.
 */
export function BoardActionsMenu({ project, boardName }: BoardActionsMenuProps) {
  const toast = useToast();
  const copyLink = async () => {
    const url = new URL(workPaths.board(project.key), window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast.show({ tone: 'ok', title: `Link to ${boardName} copied` });
    } catch {
      toast.show({ tone: 'warn', title: 'Copy the link from the address bar', body: url });
    }
  };
  return (
    <Menu
      align="end"
      trigger={(props) => (
        <IconButton {...props} label="Board actions" icon="more" variant="secondary" />
      )}
    >
      <MenuItem onSelect={() => navigateTo(settingsPath(project.key, 'board'))}>
        Board settings
      </MenuItem>
      <MenuItem onSelect={() => navigateTo(workflowPaths.list(project.key))}>Workflow</MenuItem>
      <MenuSeparator />
      <MenuItem onSelect={() => void copyLink()}>Copy board link</MenuItem>
    </Menu>
  );
}
