import type { SettingResponse } from '@bemmoly/shared';
import type { Actor, Authorize, ResourceRef } from '../../contracts/authz.ts';
import type { RequestMeta } from '../audit/index.ts';
import type { KernelSettingsService } from './service.ts';

export const MANAGE_SETTINGS = 'workspace.settings.manage';

export interface SettingsAdminDeps {
  settings: KernelSettingsService;
  authorize: Authorize;
}

/** What the admin API may do with settings, each call authorized first. */
export interface SettingsAdmin {
  list(actor: Actor): Promise<SettingResponse[]>;
  get(actor: Actor, key: string): Promise<SettingResponse>;
  /** Replaces the value; for a secret, sets the new secret. Returns the write-only view. */
  put(actor: Actor, key: string, value: unknown, meta?: RequestMeta): Promise<SettingResponse>;
  reset(actor: Actor, key: string, meta?: RequestMeta): Promise<void>;
}

export function createSettingsAdmin(deps: SettingsAdminDeps): SettingsAdmin {
  const { settings, authorize } = deps;
  const resourceOf = (key: string): ResourceRef => {
    const { moduleId } = settings.catalog.get(key);
    return moduleId ? { kind: 'module', id: moduleId, moduleId } : { kind: 'workspace' };
  };
  const check = (actor: Actor, key: string) => authorize(actor, MANAGE_SETTINGS, resourceOf(key));
  return {
    async list(actor) {
      await authorize(actor, MANAGE_SETTINGS, { kind: 'workspace' });
      return settings.viewAll();
    },
    async get(actor, key) {
      await check(actor, key);
      return settings.view(key);
    },
    async put(actor, key, value, meta) {
      await check(actor, key);
      await settings.write(key, value, actor, meta);
      return settings.view(key);
    },
    async reset(actor, key, meta) {
      await check(actor, key);
      await settings.reset(key, actor, meta);
    },
  };
}
