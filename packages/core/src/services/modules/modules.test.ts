import { ConflictError, ForbiddenError, ValidationError } from '@bemmoly/shared';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../contracts/authz.ts';
import type { BemmolyModule } from '../../modules/contract.ts';
import { loadModules } from '../../modules/loader.ts';
import type { KernelChangelogRunner } from '../changelog/index.ts';
import { createModuleAdmin } from './admin.ts';
import { listModuleManifests } from './list.ts';
import { createModuleState } from './state.ts';
import { createMemoryModuleStateStore } from './store.ts';

const admin: Actor = { kind: 'user', id: 'admin' };
const logger = pino({ level: 'silent' });

function module(id: string, dependsOn?: string[]): BemmolyModule {
  return {
    id,
    version: '1.0.0',
    coreApi: '^0.1.0',
    defaultAccess: 'everyone',
    changelog: [],
    ...(dependsOn ? { dependsOn } : {}),
    register: (ctx) => ctx.navigation.add({ id, label: id, path: `/${id}`, placement: 'top' }),
  };
}

function fakeRunner(): KernelChangelogRunner {
  return {
    update: vi.fn(async () => []),
    status: vi.fn(async () => []),
    validate: vi.fn(async () => []),
    plan: vi.fn(async () => []),
    history: vi.fn(async () => []),
    tag: vi.fn(),
    rollback: vi.fn(async () => []),
    rollbackPlan: vi.fn(async () => ({
      steps: [{ module: 'docs', id: '0001-a', description: '', reversible: true }],
      irreversible: [],
    })),
  } as KernelChangelogRunner;
}

const NONE = { mode: 'none' } as const;

async function setup(pinned: string[] = []) {
  const registry = loadModules({
    available: [module('work'), module('docs'), module('desk', ['work'])],
  });
  const store = createMemoryModuleStateStore();
  const runner = fakeRunner();
  const realtime = { publish: vi.fn(async () => undefined) };
  const state = createModuleState({
    registry,
    store,
    runner,
    contexts: ['production'],
    pinned,
    realtime,
    logger,
  });
  await state.initialize({ migrate: true });
  const access = { check: vi.fn(async () => undefined), apply: vi.fn(async () => undefined) };
  const backup = { backupBeforeRemoval: vi.fn(async () => ({ backupId: 'b1' })) };
  const authorize = vi.fn(async () => undefined);
  const moduleAdmin = createModuleAdmin({
    registry,
    state,
    store,
    runner,
    contexts: ['production'],
    authorize,
    access,
    backup,
  });
  return { registry, state, runner, realtime, moduleAdmin, access, backup, authorize };
}

/** Every module on, as an admin would turn them on one by one. */
async function setupAllEnabled() {
  const context = await setup();
  for (const id of ['work', 'docs', 'desk']) await context.moduleAdmin.enable(admin, id, NONE);
  context.access.apply.mockClear();
  return context;
}

describe('module state', () => {
  it('enables nothing on a fresh install', async () => {
    const { state, runner } = await setup();
    expect(state.enabledIds()).toEqual([]);
    expect(runner.update).toHaveBeenCalledWith({ contexts: ['production'], modules: [] });
  });

  it('follows BEMMOLY_MODULES exactly and becomes read-only', async () => {
    const { state, moduleAdmin } = await setup(['docs']);
    expect(state.enabledIds()).toEqual(['docs']);
    await expect(moduleAdmin.enable(admin, 'work', NONE)).rejects.toBeInstanceOf(ConflictError);
    expect((await moduleAdmin.list(admin)).pinned).toBe(true);
  });
});

describe('module admin', () => {
  it('disables and re-enables, running the changelog and granting the chosen access', async () => {
    const { state, moduleAdmin, runner, realtime, access } = await setupAllEnabled();
    await expect(moduleAdmin.disable(admin, 'work')).rejects.toThrow(/Disable desk first/);
    await moduleAdmin.disable(admin, 'docs');
    expect(state.isEnabled('docs')).toBe(false);
    expect(realtime.publish).toHaveBeenCalledWith({ kind: 'modules.changed', ids: ['docs'] });
    const everyone = { mode: 'everyone' } as const;
    const enabled = await moduleAdmin.enable(admin, 'docs', everyone);
    expect(enabled).toMatchObject({ id: 'docs', enabled: true, changelogState: 'current' });
    expect(runner.update).toHaveBeenLastCalledWith({
      contexts: ['production'],
      modules: ['work', 'desk', 'docs'],
    });
    expect(access.check).toHaveBeenLastCalledWith(everyone);
    expect(access.apply).toHaveBeenCalledWith('docs', everyone, admin);
  });

  it('checks the access choice before running the changelog', async () => {
    const { moduleAdmin, access, runner, state } = await setup();
    access.check.mockRejectedValueOnce(
      new ValidationError('Some of the chosen teams do not exist'),
    );
    await expect(
      moduleAdmin.enable(admin, 'docs', { mode: 'teams', teamIds: ['t1'] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(runner.update).toHaveBeenCalledTimes(1);
    expect(state.isEnabled('docs')).toBe(false);
  });

  it('refuses to enable a module whose dependency is off', async () => {
    const { moduleAdmin } = await setup();
    await expect(moduleAdmin.enable(admin, 'desk', NONE)).rejects.toThrow(/Enable work first/);
  });

  it('removes data only for a disabled module, confirmed, after a backup', async () => {
    const { moduleAdmin, backup, runner } = await setupAllEnabled();
    await expect(moduleAdmin.removeData(admin, 'docs', 'docs')).rejects.toThrow(
      /Disable the module/,
    );
    await moduleAdmin.disable(admin, 'docs');
    await expect(moduleAdmin.removeData(admin, 'docs', 'work')).rejects.toBeInstanceOf(
      ValidationError,
    );
    const removed = await moduleAdmin.removeData(admin, 'docs', 'docs');
    expect(backup.backupBeforeRemoval).toHaveBeenCalledWith({ moduleId: 'docs', actor: admin });
    expect(runner.rollback).toHaveBeenCalledWith('docs', { count: 1 });
    expect(removed.changelogState).toBe('removed');
  });

  it('authorizes before anything else', async () => {
    const { moduleAdmin, authorize, state } = await setupAllEnabled();
    authorize.mockRejectedValueOnce(new ForbiddenError());
    await expect(moduleAdmin.disable(admin, 'docs')).rejects.toBeInstanceOf(ForbiddenError);
    expect(state.isEnabled('docs')).toBe(true);
    expect(authorize).toHaveBeenCalledWith(admin, 'workspace.modules.manage', {
      kind: 'workspace',
    });
  });
});

describe('listModuleManifests', () => {
  it('lists enabled modules the actor may see', async () => {
    const { registry } = await setup();
    const access = { modulesFor: async () => new Set(['docs']), canAccess: async () => true };
    const items = await listModuleManifests(registry, {
      enabled: ['work', 'docs'],
      actor: admin,
      access,
    });
    expect(items.map((item) => item.id)).toEqual(['docs']);
  });
});
