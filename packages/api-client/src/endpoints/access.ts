import {
  adminModuleSchema,
  capabilityMatrixSchema,
  createModuleGrantSchema,
  createRoleSchema,
  listSchema,
  moduleGrantSchema,
  moduleGrantsResponseSchema,
  modulesResponseSchema,
  putRoleCapabilitiesSchema,
  removeModuleDataRequestSchema,
  roleCapabilitiesResponseSchema,
  roleSchema,
  rolesResponseSchema,
  updateRoleSchema,
  type CreateModuleGrantInput,
  type CreateRoleInput,
  type PutRoleCapabilitiesInput,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

const adminModulesSchema = listSchema(adminModuleSchema);

export function accessEndpoints(http: Http) {
  return {
    roles: {
      list: async () => http.request('/api/v1/roles', rolesResponseSchema),
      create: async (body: CreateRoleInput) =>
        http.request('/api/v1/roles', roleSchema, {
          method: 'POST',
          body: validated(createRoleSchema, body),
          idempotent: true,
        }),
      rename: async (id: string, name: string) =>
        http.request(`/api/v1/roles/${enc(id)}`, roleSchema, {
          method: 'PATCH',
          body: validated(updateRoleSchema, { name }),
        }),
      remove: async (id: string) => http.send(`/api/v1/roles/${enc(id)}`, { method: 'DELETE' }),
      capabilities: async (id: string) =>
        http.request(`/api/v1/roles/${enc(id)}/capabilities`, roleCapabilitiesResponseSchema),
      /** Upserts the listed rows; rows not listed keep their value. */
      saveCapabilities: async (id: string, items: PutRoleCapabilitiesInput['items']) =>
        http.request(`/api/v1/roles/${enc(id)}/capabilities`, roleCapabilitiesResponseSchema, {
          method: 'PUT',
          body: validated(putRoleCapabilitiesSchema, { items }),
        }),
    },
    /** The whole roles matrix in one call. */
    capabilities: async () => http.request('/api/v1/capabilities', capabilityMatrixSchema),
    moduleGrants: {
      list: async (moduleId?: string) =>
        http.request('/api/v1/module-grants', moduleGrantsResponseSchema, { query: { moduleId } }),
      create: async (body: CreateModuleGrantInput) =>
        http.request('/api/v1/module-grants', moduleGrantSchema, {
          method: 'POST',
          body: validated(createModuleGrantSchema, body),
          idempotent: true,
        }),
      remove: async (id: string) =>
        http.send(`/api/v1/module-grants/${enc(id)}`, { method: 'DELETE' }),
    },
    modules: {
      /** Enabled and granted to this person; the shell fetches it after /me. */
      list: async () => (await http.request('/api/v1/modules', modulesResponseSchema)).items,
    },
    adminModules: {
      list: async () => http.request('/api/v1/admin/modules', adminModulesSchema),
      enable: async (id: string) =>
        http.send(`/api/v1/admin/modules/${enc(id)}/enable`, { method: 'POST' }),
      disable: async (id: string) =>
        http.send(`/api/v1/admin/modules/${enc(id)}/disable`, { method: 'POST' }),
      removeData: async (id: string, confirm: string) =>
        http.send(`/api/v1/admin/modules/${enc(id)}/remove-data`, {
          method: 'POST',
          body: validated(removeModuleDataRequestSchema, { confirm }),
        }),
    },
  };
}
