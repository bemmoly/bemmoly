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
  const applyDefaultAccess = vi.fn(async () => undefined);
  const backup = { backupBeforeRemoval: vi.fn(async () => ({ backupId: 'b1' })) };
  const authorize = vi.fn(async () => undefined);
  const moduleAdmin = createModuleAdmin({
    registry,
    state,
    store,
    runner,
    contexts: ['production'],
    authorize,
    applyDefaultAccess,
    backup,
  });
  return { registry, state, runner, realtime, moduleAdmin, applyDefaultAccess, backup, authorize };
}

describe('module state', () => {
  it('enables every module on a fresh install and migrates them', async () => {
    const { state, runner } = await setup();
    expect(state.enabledIds()).toEqual(['work', 'docs', 'desk']);
    expect(runner.update).toHaveBeenCalledWith({
      contexts: ['production'],
      modules: ['work', 'docs', 'desk'],
    });
  });

  it('follows BEMMOLY_MODULES exactly and becomes read-only', async () => {
    const { state, moduleAdmin } = await setup(['docs']);
    expect(state.enabledIds()).toEqual(['docs']);
    await expect(moduleAdmin.enable(admin, 'work')).rejects.toBeInstanceOf(ConflictError);
    expect((await moduleAdmin.list(admin)).pinned).toBe(true);
  });
});

describe('module admin', () => {
  it('disables and re-enables, running the changelog and the default grant', async () => {
    const { state, moduleAdmin, runner, realtime, applyDefaultAccess } = await setup();
    await expect(moduleAdmin.disable(admin, 'work')).rejects.toThrow(/Disable desk first/);
    await moduleAdmin.disable(admin, 'docs');
    expect(state.isEnabled('docs')).toBe(false);
    expect(realtime.publish).toHaveBeenCalledWith({ kind: 'modules.changed', ids: ['docs'] });
    const enabled = await moduleAdmin.enable(admin, 'docs');
    expect(enabled).toMatchObject({ id: 'docs', enabled: true, changelogState: 'current' });
    expect(runner.update).toHaveBeenLastCalledWith({
      contexts: ['production'],
      modules: ['work', 'desk', 'docs'],
    });
    expect(applyDefaultAccess).toHaveBeenCalledWith(
      { id: 'docs', defaultAccess: 'everyone' },
      admin,
    );
  });

  it('refuses to enable a module whose dependency is off', async () => {
    const { moduleAdmin } = await setup();
    await moduleAdmin.disable(admin, 'desk');
    await moduleAdmin.disable(admin, 'work');
    await expect(moduleAdmin.enable(admin, 'desk')).rejects.toThrow(/Enable work first/);
  });

  it('removes data only for a disabled module, confirmed, after a backup', async () => {
    const { moduleAdmin, backup, runner } = await setup();
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
    const { moduleAdmin, authorize, state } = await setup();
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
