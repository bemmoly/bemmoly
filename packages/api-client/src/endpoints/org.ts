import {
  costCentreSchema,
  costCentresResponseSchema,
  createCostCentreSchema,
  createLocationSchema,
  createPersonSchema,
  locationSchema,
  locationsResponseSchema,
  peoplePageSchema,
  peopleResponseSchema,
  personSchema,
  updateCostCentreSchema,
  updateLocationSchema,
  updatePersonSchema,
  type CreatePersonInput,
  type EmploymentState,
  type UpdatePersonInput,
} from '@bemmoly/shared/people';
import type { z } from 'zod';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

export interface PeopleFilter {
  cursor?: string;
  limit?: number;
  teamId?: string;
  locationId?: string;
  costCentreId?: string;
  managerId?: string;
  state?: EmploymentState;
}

/** TanStack Query keys for the person record and org data; the root clears all of them. */
export const orgKeys = {
  all: () => ['org'] as const,
  people: (filter: PeopleFilter = {}) => ['org', 'people', filter] as const,
  person: (userId: string) => ['org', 'person', userId] as const,
  managers: (userId: string) => ['org', 'person', userId, 'managers'] as const,
  reports: (userId: string, all = false) => ['org', 'person', userId, 'reports', all] as const,
  locations: () => ['org', 'locations'] as const,
  costCentres: () => ['org', 'cost-centres'] as const,
};

/** List, read, create, update and delete for one org entity. */
const crud = <
  Item extends z.ZodType,
  List extends z.ZodType,
  Create extends z.ZodType,
  Update extends z.ZodType,
>(
  http: Http,
  path: string,
  schemas: { item: Item; list: List; create: Create; update: Update },
) => ({
  list: async () => http.request(path, schemas.list),
  get: async (id: string) => http.request(`${path}/${enc(id)}`, schemas.item),
  create: async (body: z.input<Create>) =>
    http.request(path, schemas.item, { method: 'POST', body: validated(schemas.create, body) }),
  update: async (id: string, body: z.input<Update>) =>
    http.request(`${path}/${enc(id)}`, schemas.item, {
      method: 'PATCH',
      body: validated(schemas.update, body),
    }),
  remove: async (id: string) => http.send(`${path}/${enc(id)}`, { method: 'DELETE' }),
});

/**
 * The kernel's person record (by user id), locations and cost centres (ADR 0050). A subpath
 * export, so only the screens that use it carry its schemas (ADR 0018).
 */
export function orgEndpoints(http: Http) {
  return {
    people: {
      list: async (filter: PeopleFilter = {}) =>
        http.request('/api/v1/people', peoplePageSchema, { query: { ...filter } }),
      get: async (userId: string) => http.request(`/api/v1/people/${enc(userId)}`, personSchema),
      create: async (body: CreatePersonInput) =>
        http.request('/api/v1/people', personSchema, {
          method: 'POST',
          body: validated(createPersonSchema, body),
        }),
      update: async (userId: string, body: UpdatePersonInput) =>
        http.request(`/api/v1/people/${enc(userId)}`, personSchema, {
          method: 'PATCH',
          body: validated(updatePersonSchema, body),
        }),
      /** Nearest manager first. */
      managers: async (userId: string) =>
        http.request(`/api/v1/people/${enc(userId)}/managers`, peopleResponseSchema),
      reports: async (userId: string, all = false) =>
        http.request(`/api/v1/people/${enc(userId)}/reports`, peopleResponseSchema, {
          query: { all: all ? 'true' : undefined },
        }),
    },
    locations: crud(http, '/api/v1/locations', {
      item: locationSchema,
      list: locationsResponseSchema,
      create: createLocationSchema,
      update: updateLocationSchema,
    }),
    costCentres: crud(http, '/api/v1/cost-centres', {
      item: costCentreSchema,
      list: costCentresResponseSchema,
      create: createCostCentreSchema,
      update: updateCostCentreSchema,
    }),
  };
}
