export { createRequestAuthorization, type AuthzDependencies } from './authorize.ts';
export {
  capabilityCatalog,
  KERNEL_CAPABILITY_CATALOG,
  moduleOfCapability,
  type CatalogEntry,
  type ModuleCatalog,
} from './catalog.ts';
export type { RequestAuthorization, RequestContext } from './context.ts';
export { countActiveOrgAdmins, loadPrincipal, type Principal } from './loaders.ts';
export { createAuthorize, createModuleAccessResolver } from './module-access.ts';
export { createModuleAccessWriter } from './module-access-writer.ts';
export {
  createModuleGrant,
  deleteModuleGrant,
  getModuleGrant,
  listModuleGrants,
} from './module-grants.ts';
export {
  applyContainerOverride,
  checkMatrixEdit,
  checkOverrideEdit,
  ORG_ADMIN_ROLE_KEY,
  resolveOrgCell,
  type MatrixCell,
} from './policy.ts';
export { bumpPrivilegeVersion, type PrivilegeScope } from './privileges.ts';
export {
  getCapabilityMatrix,
  getRoleCapabilities,
  putRoleCapabilities,
} from './role-capabilities.ts';
export { createRole, deleteRole, getRole, listRoles, updateRole } from './roles.ts';
