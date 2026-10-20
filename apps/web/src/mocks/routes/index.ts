import { logoRoutes } from '../logo.ts';
import type { MockRoute } from '../types.ts';
import { apiTokenRoutes } from './api-tokens.ts';
import { appearanceRoutes } from './appearance.ts';
import { codeHostRoutes } from './code-hosts.ts';
import { aiAdminRoutes } from './ai-admin.ts';
import { aiInsightRoutes } from './ai-insights.ts';
import { aiPlanRoutes } from './ai-plans.ts';
import { aiProviderRoutes } from './ai-providers.ts';
import { aiAnswerRoutes } from './ai-answers.ts';
import { aiRoleRoutes } from './ai-roles.ts';
import { docsFindRoutes } from './docs-find.ts';
import { docsHistoryRoutes } from './docs-history.ts';
import { docsLibraryRoutes } from './docs-library.ts';
import { docsTemplateRoutes } from './docs-templates.ts';
import { docsMemberRoutes } from './docs-members.ts';
import { docsMoveRoutes } from './docs-moves.ts';
import { docsEditorAiRoutes } from './docs-editor-ai.ts';
import { docsRoutes } from './docs.ts';
import { importContainerRoutes } from './import-containers.ts';
import { importRoutes } from './imports.ts';
import { notificationRoutes } from './notifications.ts';
import { operationsRoutes } from './operations.ts';
import { peopleRoutes } from './people.ts';
import { sessionRoutes } from './session.ts';
import { signInRoutes } from './sign-in.ts';
import { settingsRoutes } from './settings.ts';
import { oauthDeviceRoutes } from './oauth-device.ts';
import { oauthRoutes } from './oauth.ts';
import { ssoBreakGlassRoutes } from './sso-break-glass.ts';
import { ssoRoutes } from './sso.ts';
import { teamRoutes } from './teams.ts';
import { webhookRoutes } from './webhooks.ts';
import { workAutomationRoutes } from './work-automation.ts';
import { workBacklogRoutes } from './work-backlog.ts';
import { workBoardRoutes } from './work-board.ts';
import { workReportRoutes } from './work-reports.ts';
import { workCodeLinkRoutes } from './work-code-links.ts';
import { workDashboardRoutes } from './work-dashboards.ts';
import { workFilterRoutes } from './work-filters.ts';
import { workIssuesRoutes } from './work-issues.ts';
import { workMembersRoutes } from './work-members.ts';
import { workMyIssuesRoutes } from './work-my-issues.ts';
import { workRoadmapRoutes } from './work-roadmap.ts';
import { workSettingsBoardRoutes } from './work-settings-boards.ts';
import { workSettingsRoutes } from './work-settings.ts';
import { workWorkflowRoutes } from './work-workflows.ts';

export const ROUTES: readonly MockRoute[] = [
  ...signInRoutes,
  ...sessionRoutes,
  ...peopleRoutes,
  ...apiTokenRoutes,
  ...teamRoutes,
  ...settingsRoutes,
  ...ssoRoutes,
  ...ssoBreakGlassRoutes,
  ...oauthRoutes,
  ...oauthDeviceRoutes,
  ...appearanceRoutes,
  ...logoRoutes,
  ...aiAdminRoutes,
  ...aiProviderRoutes,
  ...aiRoleRoutes,
  ...aiPlanRoutes,
  ...aiInsightRoutes,
  ...aiAnswerRoutes,
  ...notificationRoutes,
  ...operationsRoutes,
  ...importRoutes,
  ...importContainerRoutes,
  ...codeHostRoutes,
  ...workCodeLinkRoutes,
  ...webhookRoutes,
  ...workBacklogRoutes,
  ...workBoardRoutes,
  ...workReportRoutes,
  ...workDashboardRoutes,
  ...workFilterRoutes,
  ...workIssuesRoutes,
  ...workMembersRoutes,
  ...workMyIssuesRoutes,
  ...workRoadmapRoutes,
  ...workSettingsRoutes,
  ...workSettingsBoardRoutes,
  ...workWorkflowRoutes,
  ...workAutomationRoutes,
  ...docsRoutes,
  ...docsLibraryRoutes,
  ...docsTemplateRoutes,
  ...docsMoveRoutes,
  ...docsFindRoutes,
  ...docsMemberRoutes,
  ...docsHistoryRoutes,
  ...docsEditorAiRoutes,
];
