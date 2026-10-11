import type { MockRoute } from '../types.ts';
import { apiTokenRoutes } from './api-tokens.ts';
import { appearanceRoutes } from './appearance.ts';
import { aiAdminRoutes } from './ai-admin.ts';
import { aiInsightRoutes } from './ai-insights.ts';
import { aiPlanRoutes } from './ai-plans.ts';
import { aiProviderRoutes } from './ai-providers.ts';
import { aiAnswerRoutes } from './ai-answers.ts';
import { aiRoleRoutes } from './ai-roles.ts';
import { docsFindRoutes } from './docs-find.ts';
import { docsHistoryRoutes } from './docs-history.ts';
import { docsLibraryRoutes } from './docs-library.ts';
import { docsMemberRoutes } from './docs-members.ts';
import { docsMoveRoutes } from './docs-moves.ts';
import { docsEditorAiRoutes } from './docs-editor-ai.ts';
import { docsRoutes } from './docs.ts';
import { importRoutes } from './imports.ts';
import { notificationRoutes } from './notifications.ts';
import { operationsRoutes } from './operations.ts';
import { peopleRoutes } from './people.ts';
import { sessionRoutes } from './session.ts';
import { settingsRoutes } from './settings.ts';
import { ssoRoutes } from './sso.ts';
import { teamRoutes } from './teams.ts';
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
  ...apiTokenRoutes,
  ...teamRoutes,
  ...settingsRoutes,
  ...ssoRoutes,
  ...appearanceRoutes,
  ...aiAdminRoutes,
  ...aiProviderRoutes,
  ...aiRoleRoutes,
  ...aiPlanRoutes,
  ...aiInsightRoutes,
  ...aiAnswerRoutes,
  ...notificationRoutes,
  ...operationsRoutes,
  ...importRoutes,
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
  ...docsEditorAiRoutes,
];
