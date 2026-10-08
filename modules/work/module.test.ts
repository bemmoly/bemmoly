import { loadModules } from '@bemmoly/core';
import { moduleManifestSchema } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import work from './module.ts';

describe('work module', () => {
  it('loads through the kernel and exposes a valid manifest', () => {
    const registry = loadModules({ available: [work] });
    const [manifest] = registry.manifests();
    expect(moduleManifestSchema.parse(manifest)).toEqual({
      id: 'work',
      version: '0.2.0',
      navigation: [
        { id: 'work.board', label: 'Board', path: '/work/board', placement: 'top' },
        { id: 'work.backlog', label: 'Backlog', path: '/work/backlog', placement: 'top' },
      ],
    });
    expect(work.defaultAccess).toBe('teams');
  });

  it('declares the Work rows of the roles matrix under its own namespace', () => {
    const registry = loadModules({ available: [work] });
    const capabilities = registry.capabilities();
    expect(capabilities.map((capability) => capability.name)).toEqual([
      'work.project.create',
      'work.project.configure',
      'work.issue.view',
      'work.issue.edit',
      'work.issue.delete',
      'work.issue.transition',
      'work.sprint.manage',
      'work.board.configure',
      'work.board.method',
      'work.board.wip',
    ]);
    expect(capabilities.every((capability) => capability.group === 'Projects')).toBe(true);
    const view = capabilities.find((capability) => capability.name === 'work.issue.view');
    expect(view?.defaults).toEqual({
      org_admin: true,
      project_admin: true,
      member: true,
      viewer: true,
      contractor: true,
    });
    const edit = capabilities.find((capability) => capability.name === 'work.issue.edit');
    expect(edit?.defaults.viewer).toBe(false);
    expect(edit?.defaults.contractor).toBe(true);
  });

  it('contributes its settings, the rank rebalance job and the /work routes', () => {
    const registry = loadModules({ available: [work] });
    const [loaded] = registry.list();
    expect(loaded?.contributions.settings.map((setting) => setting.key)).toEqual([
      'work.defaultMethod',
      'work.defaultEstimationUnit',
      'work.jobs.rankRebalance.schedule',
    ]);
    expect(loaded?.contributions.jobs.map((job) => job.name)).toEqual([
      'work.rank.rebalance',
      'work.automation.run',
    ]);
    expect(loaded?.contributions.jobs[0]?.scheduleSetting).toBe('work.jobs.rankRebalance.schedule');
    expect(registry.routes().map((route) => route.prefix)).toEqual(['/work']);
  });
});
