import { createApiClient, enc, validated, type Http } from '@bemmoly/api-client';
import { approvalEndpoints } from '@bemmoly/api-client/approvals';
import { orgEndpoints } from '@bemmoly/api-client/org';
import { customFieldDefinitionSchema } from '@bemmoly/shared/custom-fields';
import type { z } from 'zod';
import {
  absencesQuerySchema,
  absencesResponseSchema,
  balancesQuerySchema,
  createJourneyTemplateBodySchema,
  createLeavePolicyBodySchema,
  createLeaveRequestBodySchema,
  createLevelBodySchema,
  createProfileFieldBodySchema,
  directoryQuerySchema,
  directoryResponseSchema,
  journeyDetailSchema,
  journeysResponseSchema,
  journeyTemplateSchema,
  journeyTemplatesResponseSchema,
  leaveBalancesResponseSchema,
  leavePoliciesResponseSchema,
  leavePolicySchema,
  leaveRequestSchema,
  leaveRequestsResponseSchema,
  levelSchema,
  levelsResponseSchema,
  listJourneysQuerySchema,
  listLeaveRequestsQuerySchema,
  myTasksResponseSchema,
  profileFieldDefinitionsResponseSchema,
  profileFieldsSchema,
  profileSchema,
  startJourneyBodySchema,
  updateJourneyTaskBodySchema,
  updateJourneyTemplateBodySchema,
  updateLeavePolicyBodySchema,
  updateLevelBodySchema,
  type AbsencesQuery,
  type BalancesQuery,
  type CreateJourneyTemplateBody,
  type CreateLeavePolicyBody,
  type CreateLeaveRequestBody,
  type CreateLevelBody,
  type CreateProfileFieldBody,
  type DirectoryQuery,
  type ListJourneysQuery,
  type ListLeaveRequestsQuery,
  type StartJourneyBody,
  type UpdateJourneyTaskBody,
  type UpdateJourneyTemplateBody,
  type UpdateLeavePolicyBody,
  type UpdateLevelBody,
} from '../../../shared/index.ts';

export const HR_BASE = '/api/v1/hr';

const post = <S extends z.ZodType>(http: Http, path: string, schema: S, body: unknown) =>
  http.request(path, schema, { method: 'POST', body });
const patch = <S extends z.ZodType>(http: Http, path: string, schema: S, body: unknown) =>
  http.request(path, schema, { method: 'PATCH', body });

/** People's own endpoints, under /api/v1/hr; the person record itself is the kernel's. */
export function peopleEndpoints(http: Http) {
  const at = (path: string) => `${HR_BASE}${path}`;
  return {
    directory: (query: DirectoryQuery = {}) =>
      http.request(at('/directory'), directoryResponseSchema, {
        query: { ...validated(directoryQuerySchema, query) },
      }),
    profile: (userId: string) => http.request(at(`/profiles/${enc(userId)}`), profileSchema),
    updateFields: (userId: string, values: Record<string, unknown>) =>
      http.request(at(`/profiles/${enc(userId)}/fields`), profileFieldsSchema, {
        method: 'PUT',
        body: { values },
      }),
    fieldDefinitions: () =>
      http.request(at('/profile-fields'), profileFieldDefinitionsResponseSchema),
    createField: (body: CreateProfileFieldBody) =>
      post(
        http,
        at('/profile-fields'),
        customFieldDefinitionSchema,
        validated(createProfileFieldBodySchema, body),
      ),
    levels: {
      list: () => http.request(at('/levels'), levelsResponseSchema),
      create: (body: CreateLevelBody) =>
        post(http, at('/levels'), levelSchema, validated(createLevelBodySchema, body)),
      update: (id: string, body: UpdateLevelBody) =>
        patch(http, at(`/levels/${enc(id)}`), levelSchema, validated(updateLevelBodySchema, body)),
      remove: (id: string) => http.send(at(`/levels/${enc(id)}`), { method: 'DELETE' }),
    },
    leave: {
      policies: (includeArchived = false) =>
        http.request(at('/leave-policies'), leavePoliciesResponseSchema, {
          query: { includeArchived: includeArchived ? 'true' : undefined },
        }),
      createPolicy: (body: CreateLeavePolicyBody) =>
        post(
          http,
          at('/leave-policies'),
          leavePolicySchema,
          validated(createLeavePolicyBodySchema, body),
        ),
      updatePolicy: (id: string, body: UpdateLeavePolicyBody) =>
        patch(
          http,
          at(`/leave-policies/${enc(id)}`),
          leavePolicySchema,
          validated(updateLeavePolicyBodySchema, body),
        ),
      requests: (query: ListLeaveRequestsQuery = {}) =>
        http.request(at('/leave-requests'), leaveRequestsResponseSchema, {
          query: { ...validated(listLeaveRequestsQuerySchema, query) },
        }),
      request: (body: CreateLeaveRequestBody) =>
        post(
          http,
          at('/leave-requests'),
          leaveRequestSchema,
          validated(createLeaveRequestBodySchema, body),
        ),
      withdraw: (id: string) =>
        post(http, at(`/leave-requests/${enc(id)}/withdraw`), leaveRequestSchema, {}),
      balances: (query: BalancesQuery = {}) =>
        http.request(at('/leave-balances'), leaveBalancesResponseSchema, {
          query: { ...validated(balancesQuerySchema, query) },
        }),
      absences: (query: AbsencesQuery) =>
        http.request(at('/absences'), absencesResponseSchema, {
          query: { ...validated(absencesQuerySchema, query) },
        }),
    },
    journeys: {
      templates: () => http.request(at('/journey-templates'), journeyTemplatesResponseSchema),
      createTemplate: (body: CreateJourneyTemplateBody) =>
        post(
          http,
          at('/journey-templates'),
          journeyTemplateSchema,
          validated(createJourneyTemplateBodySchema, body),
        ),
      updateTemplate: (id: string, body: UpdateJourneyTemplateBody) =>
        patch(
          http,
          at(`/journey-templates/${enc(id)}`),
          journeyTemplateSchema,
          validated(updateJourneyTemplateBodySchema, body),
        ),
      list: (query: ListJourneysQuery = {}) =>
        http.request(at('/journeys'), journeysResponseSchema, {
          query: { ...validated(listJourneysQuerySchema, query) },
        }),
      get: (id: string) => http.request(at(`/journeys/${enc(id)}`), journeyDetailSchema),
      start: (body: StartJourneyBody) =>
        post(http, at('/journeys'), journeyDetailSchema, validated(startJourneyBodySchema, body)),
      myTasks: () => http.request(at('/journey-tasks'), myTasksResponseSchema),
      updateTask: (id: string, body: UpdateJourneyTaskBody) =>
        patch(
          http,
          at(`/journey-tasks/${enc(id)}`),
          journeyDetailSchema,
          validated(updateJourneyTaskBodySchema, body),
        ),
    },
  };
}

const client = createApiClient();

/** The shell's client plus the person record, approvals and People's own endpoints. */
export const api = {
  ...client,
  org: orgEndpoints(client.http),
  approvals: approvalEndpoints(client.http),
  people: peopleEndpoints(client.http),
};
