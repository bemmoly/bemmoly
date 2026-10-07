import { describe, expect, it } from 'vitest';
import { isCapabilityOfModule, isKernelCapability } from '../capabilities/index.ts';
import { isModuleId } from '../modules/index.ts';
import { apiErrorBodySchema } from './api/index.ts';
import { modulesResponseSchema } from './modules/index.ts';

describe('shared schemas', () => {
  it('accepts the documented error body and rejects unknown codes', () => {
    const body = { code: 'not_found', message: 'Missing', requestId: 'req-1' };
    expect(apiErrorBodySchema.parse(body)).toEqual(body);
    expect(apiErrorBodySchema.safeParse({ ...body, code: 'teapot' }).success).toBe(false);
    expect(apiErrorBodySchema.safeParse({ code: 'not_found', message: 'x' }).success).toBe(false);
  });

  it('validates module manifests', () => {
    const ok = {
      items: [
        {
          id: 'sample',
          version: '0.0.0',
          navigation: [{ id: 'sample', label: 'Sample', path: '/sample', placement: 'top' }],
        },
      ],
    };
    expect(modulesResponseSchema.parse(ok)).toEqual(ok);
    expect(
      modulesResponseSchema.safeParse({ items: [{ id: 'Bad Id', version: '1', navigation: [] }] })
        .success,
    ).toBe(false);
  });

  it('checks module ids and capability namespaces', () => {
    expect(isModuleId('work')).toBe(true);
    expect(isModuleId('Work')).toBe(false);
    expect(isKernelCapability('workspace.delete')).toBe(true);
    expect(isKernelCapability('work.issue.transition')).toBe(false);
    expect(isCapabilityOfModule('work.issue.transition', 'work')).toBe(true);
    expect(isCapabilityOfModule('docs.page.publish', 'work')).toBe(false);
  });
});
