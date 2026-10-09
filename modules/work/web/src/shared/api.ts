import { createApiClient } from '@bemmoly/api-client';
import {
  workBoardIssuesEndpoints,
  workBoardsEndpoints,
  workIssueActivityEndpoints,
  workIssueEndpoints,
  workProjectCatalogEndpoints,
  workSettingsEndpoints,
  workWorkflowEndpoints,
} from '../api/index.ts';

/**
 * The module's API client: the shell's generic client plus the Work endpoints,
 * which live in this package so @bemmoly/api-client stays generic. The shell's
 * client is not shared through the chunk props, and the two are identical:
 * same origin, same session cookie; a 401 here surfaces as the query's error
 * and the shell's own calls send the person to sign in.
 */
const client = createApiClient();
const boardsApi = workBoardsEndpoints(client.http);
const boardIssuesApi = workBoardIssuesEndpoints(client.http);
const settingsApi = workSettingsEndpoints(client.http);

export const api = {
  ...client,
  work: {
    ...boardsApi,
    ...boardIssuesApi,
    ...settingsApi,
    /** Two streams expose these areas; their endpoints live side by side under one key. */
    projects: { ...boardsApi.projects, ...settingsApi.projects },
    boards: { ...boardsApi.boards, ...settingsApi.boards },
    /** The settings endpoints own issue types; the board only lists them. */
    issueTypes: settingsApi.issueTypes,
    /** The workflow editor's endpoints carry everything the board needs too. */
    workflows: workWorkflowEndpoints(client.http),
    ...workIssueEndpoints(client.http),
    ...workIssueActivityEndpoints(client.http),
    ...workProjectCatalogEndpoints(client.http),
  },
};

export type WorkApi = typeof api;

/** WebSocket URL for /ws on the same origin, as the shell computes it. */
export function realtimeUrl(): string {
  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`;
}
