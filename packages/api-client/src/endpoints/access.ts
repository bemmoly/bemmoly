import {
  adminModuleSchema,
  capabilityInfoSchema,
  createModuleGrantRequestSchema,
  createRoleRequestSchema,
  listSchema,
  moduleGrantSchema,
  modulesResponseSchema,
  removeModuleDataRequestSchema,
  roleCapabilitiesSchema,
  roleSchema,
  type CreateModuleGrantRequest,
  type CreateRoleRequest,
  type RoleCapability,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

const rolesSchema = listSchema(roleSchema);
const capabilitiesSchema = listSchema(capabilityInfoSchema);
const grantsSchema = listSchema(moduleGrantSchema);
const adminModulesSchema = listSchema(adminModuleSchema);

export function accessEndpoints(http: Http) {
  return {
    roles: {
      list: async () => http.request('/api/v1/roles', rolesSchema),
      create: async (body: CreateRoleRequest) =>
        http.request('/api/v1/roles', roleSchema, {
          method: 'POST',
          body: validated(createRoleRequestSchema, body),
          idempotent: true,
        }),
      capabilities: async (roleId: string) =>
        http.request(`/api/v1/roles/${enc(roleId)}/capabilities`, roleCapabilitiesSchema),
      saveCapabilities: async (roleId: string, items: readonly RoleCapability[]) =>
        http.request(`/api/v1/roles/${enc(roleId)}/capabilities`, roleCapabilitiesSchema, {
          method: 'PUT',
          body: validated(roleCapabilitiesSchema, { items }),
        }),
    },
    capabilities: {
      list: async () => http.request('/api/v1/capabilities', capabilitiesSchema),
    },
    moduleGrants: {
      list: async () => http.request('/api/v1/module-grants', grantsSchema),
      create: async (body: CreateModuleGrantRequest) =>
        http.request('/api/v1/module-grants', moduleGrantSchema, {
          method: 'POST',
          body: validated(createModuleGrantRequestSchema, body),
          idempotent: true,
        }),
      remove: async (id: string) =>
        http.send(`/api/v1/module-grants/${enc(id)}`, { method: 'DELETE' }),
    },
    modules: {
      /** Enabled and granted to this person; the shell boots from it. */
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
