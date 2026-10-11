import { describe, expect, it } from 'vitest';
import { createMockApi } from '../mocks/dispatch.ts';
import { demoWorkspace } from './workspace.ts';

describe('demoWorkspace', () => {
  it('starts signed in, with every shipped module on except the developer sample', () => {
    const db = demoWorkspace();
    expect(db.signedInAs).not.toBeNull();
    expect(db.manifests.map((manifest) => manifest.id)).toContain('work');
    expect(db.manifests.map((manifest) => manifest.id)).not.toContain('sample');
    expect(db.adminModules.map((module) => module.id)).not.toContain('sample');
    expect(db.grants.some((grant) => grant.moduleId === 'sample')).toBe(false);
  });

  it('answers the session and Work from memory', () => {
    const api = createMockApi(demoWorkspace());
    expect(api.dispatch('GET', '/api/v1/me', undefined)?.status).toBe(200);
    expect(api.dispatch('GET', '/api/v1/work/projects', undefined)?.status).toBe(200);
  });

  it('starts in the theme and mode ?theme and ?mode name, and ignores ones it does not know', () => {
    const pine = demoWorkspace({ search: '?theme=pine&mode=dark' }).settings;
    expect(pine['appearance.theme']).toBe('pine');
    expect(pine['appearance.defaultMode']).toBe('dark');
    expect(demoWorkspace({ search: '?mode=system' }).settings['appearance.defaultMode']).toBe(
      'system',
    );
    const neon = demoWorkspace({ search: '?theme=neon&mode=dim' }).settings;
    expect(neon['appearance.theme']).toBe('bemmoly');
    expect(neon['appearance.defaultMode']).toBe('light');
  });

  it('maps a retired preset in an old link to its theme, mode and typeface', () => {
    const ocean = demoWorkspace({ search: '?theme=ocean' }).settings;
    expect(ocean['appearance.theme']).toBe('bemmoly');
    expect(ocean['appearance.defaultMode']).toBe('dark');
    expect(ocean['appearance.font']).toBe('inter');
  });

  it('reports the release it was built from and no other version', () => {
    const db = demoWorkspace({ version: '9.8.7' });
    const versions = JSON.stringify([
      db.system,
      db.updates,
      db.backups,
      db.adminModules,
      db.manifests,
      db.audit,
    ]).match(/(?<![\d.])\d+\.\d+\.\d+(?![.\d])/g);
    expect(new Set(versions)).toEqual(new Set(['9.8.7']));
    expect(db.updates.available).toBeNull();
  });

  it('starts over each time, so a reload resets the data', () => {
    const first = demoWorkspace();
    first.settings['workspace.name'] = 'Changed';
    expect(demoWorkspace().settings['workspace.name']).toBe('Acme Labs');
  });
});
