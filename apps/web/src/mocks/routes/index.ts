import type { MockRoute } from '../types.ts';
import { operationsRoutes } from './operations.ts';
import { peopleRoutes } from './people.ts';
import { sessionRoutes } from './session.ts';
import { settingsRoutes } from './settings.ts';
import { workBacklogRoutes } from './work-backlog.ts';
import { workBoardRoutes } from './work-board.ts';
import { workIssuesRoutes } from './work-issues.ts';
import { workSettingsBoardRoutes } from './work-settings-boards.ts';
import { workSettingsRoutes } from './work-settings.ts';
import { workWorkflowRoutes } from './work-workflows.ts';

export const ROUTES: readonly MockRoute[] = [
  ...sessionRoutes,
  ...peopleRoutes,
  ...settingsRoutes,
  ...operationsRoutes,
  ...workBacklogRoutes,
  ...workBoardRoutes,
  ...workIssuesRoutes,
  ...workSettingsRoutes,
  ...workSettingsBoardRoutes,
  ...workWorkflowRoutes,
];
