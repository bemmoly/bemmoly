import {
  ForbiddenError,
  KERNEL_CAPABILITIES,
  type KernelCapability,
  type SettingResponse,
} from '@bemmoly/shared';
import type { Actor, Authorize, ResourceRef } from '../../contracts/authz.ts';
import type { RequestMeta } from '../audit/index.ts';
import type { KernelSettingsService } from './service.ts';

export const MANAGE_SETTINGS = 'workspace.settings.manage';

/**
 * Which capability owns a workspace key, by the group before its first dot.
 * Anything not listed (workspace.*, auth.*, ai.*, …) is general settings.
 */
export const SETTING_GROUP_CAPABILITIES: Readonly<Record<string, KernelCapability>> = {
  appearance: 'workspace.appearance.manage',
  email: 'workspace.email.manage',
  system: 'workspace.system.manage',
};

/** Holding any of these lets a person read the settings list their pages are built from. */
export const SETTINGS_READERS: readonly KernelCapability[] = KERNEL_CAPABILITIES.filter(
  (capability) => /^workspace\.[a-z]+\.manage$/.test(capability),
);

export function capabilityForSettingKey(key: string): KernelCapability {
  return SETTING_GROUP_CAPABILITIES[key.split('.')[0] ?? ''] ?? MANAGE_SETTINGS;
}

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

const workspace: ResourceRef = { kind: 'workspace' };

export function createSettingsAdmin(deps: SettingsAdminDeps): SettingsAdmin {
  const { settings, authorize } = deps;

  /** Passes when any capability does; a refusal from each is the only refusal. */
  async function authorizeAny(actor: Actor, capabilities: readonly KernelCapability[]) {
    let refusal: unknown = new ForbiddenError();
    for (const capability of capabilities) {
      try {
        await authorize(actor, capability, workspace);
        return;
      } catch (error) {
        if (!(error instanceof ForbiddenError)) throw error;
        refusal = error;
      }
    }
    throw refusal;
  }

  /** A module's keys stay with settings.manage on that module; workspace keys go by group. */
  const authorizeWrite = (actor: Actor, key: string) => {
    const { moduleId } = settings.catalog.get(key);
    if (moduleId)
      return authorize(actor, MANAGE_SETTINGS, { kind: 'module', id: moduleId, moduleId });
    return authorize(actor, capabilityForSettingKey(key), workspace);
  };

  const authorizeRead = (actor: Actor, key: string) => {
    const { moduleId } = settings.catalog.get(key);
    if (moduleId)
      return authorize(actor, MANAGE_SETTINGS, { kind: 'module', id: moduleId, moduleId });
    return authorizeAny(actor, SETTINGS_READERS);
  };

  return {
    async list(actor) {
      await authorizeAny(actor, SETTINGS_READERS);
      return settings.viewAll();
    },
    async get(actor, key) {
      await authorizeRead(actor, key);
      return settings.view(key);
    },
    async put(actor, key, value, meta) {
      await authorizeWrite(actor, key);
      await settings.write(key, value, actor, meta);
      return settings.view(key);
    },
    async reset(actor, key, meta) {
      await authorizeWrite(actor, key);
      await settings.reset(key, actor, meta);
    },
  };
}
