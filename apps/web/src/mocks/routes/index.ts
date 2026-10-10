import type { MockRoute } from '../types.ts';
import { docsFindRoutes } from './docs-find.ts';
import { docsHistoryRoutes } from './docs-history.ts';
import { docsLibraryRoutes } from './docs-library.ts';
import { docsMemberRoutes } from './docs-members.ts';
import { docsMoveRoutes } from './docs-moves.ts';
import { docsRoutes } from './docs.ts';
import { notificationRoutes } from './notifications.ts';
import { operationsRoutes } from './operations.ts';
import { peopleRoutes } from './people.ts';
import { sessionRoutes } from './session.ts';
import { settingsRoutes } from './settings.ts';
import { workBacklogRoutes } from './work-backlog.ts';
import { workBoardRoutes } from './work-board.ts';
import { workFilterRoutes } from './work-filters.ts';
import { workIssuesRoutes } from './work-issues.ts';
import { workMembersRoutes } from './work-members.ts';
import { workMyIssuesRoutes } from './work-my-issues.ts';
import { workSettingsBoardRoutes } from './work-settings-boards.ts';
import { workSettingsRoutes } from './work-settings.ts';
import { workWorkflowRoutes } from './work-workflows.ts';

export const ROUTES: readonly MockRoute[] = [
  ...sessionRoutes,
  ...peopleRoutes,
  ...settingsRoutes,
  ...notificationRoutes,
  ...operationsRoutes,
  ...workBacklogRoutes,
  ...workBoardRoutes,
  ...workFilterRoutes,
  ...workIssuesRoutes,
  ...workMembersRoutes,
  ...workMyIssuesRoutes,
  ...workSettingsRoutes,
  ...workSettingsBoardRoutes,
  ...workWorkflowRoutes,
  ...docsRoutes,
  ...docsLibraryRoutes,
  ...docsMoveRoutes,
  ...docsFindRoutes,
  ...docsMemberRoutes,
  ...docsHistoryRoutes,
];
