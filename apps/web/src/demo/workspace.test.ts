import { describe, expect, it } from 'vitest';
import { createMockApi } from '../mocks/dispatch.ts';
import { demoWorkspace } from './workspace.ts';

describe('demoWorkspace', () => {
  it('starts signed in, with every shipped module on except the developer sample', () => {
    const db = demoWorkspace();
    expect(db.signedInAs).not.toBeNull();
    expect(db.manifests.map((manifest) => manifest.id)).toContain('work');
    expect(db.manifests.map((manifest) => manifest.id)).not.toContain('sample');
    expect(db.adminModules.find((module) => module.id === 'sample')?.enabled).toBe(false);
    expect(db.grants.some((grant) => grant.moduleId === 'sample')).toBe(false);
  });

  it('answers the session and Work from memory', () => {
    const api = createMockApi(demoWorkspace());
    expect(api.dispatch('GET', '/api/v1/me', undefined)?.status).toBe(200);
    expect(api.dispatch('GET', '/api/v1/work/projects', undefined)?.status).toBe(200);
  });

  it('starts in the preset ?theme names, and ignores one it does not know', () => {
    expect(demoWorkspace('?theme=ocean').settings['appearance.theme']).toBe('ocean');
    expect(demoWorkspace('?theme=ocean').settings['appearance.mode']).toBe('dark');
    expect(demoWorkspace('?theme=neon').settings['appearance.theme']).toBe('classic');
  });

  it('starts over each time, so a reload resets the data', () => {
    const first = demoWorkspace();
    first.settings['workspace.name'] = 'Changed';
    expect(demoWorkspace().settings['workspace.name']).toBe('Acme Labs');
  });
});
