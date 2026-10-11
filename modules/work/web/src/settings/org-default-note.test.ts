import type { SchemeUsage } from '@bemmoly/module-work/shared';
import { describe, expect, it } from 'vitest';
import { usageSentence } from './org-default-note.tsx';

const project = (key: string) => ({
  id: `00000000-0000-7000-8000-${key.padStart(12, '0')}`,
  key,
  name: key,
});

const usage = (projects: number, own: string[]): SchemeUsage => ({
  kind: 'board',
  originName: 'Workspace board',
  projects,
  overriders: own.map(project),
});

describe('usageSentence', () => {
  it('says plainly who a change reaches', () => {
    expect(usageSentence(usage(0, []))).toBe(
      'No projects yet. New projects start from this default.',
    );
    expect(usageSentence(usage(1, []))).toBe(
      'Used by 1 project. None has its own version, so changes here reach all of them.',
    );
    expect(usageSentence(usage(12, ['PLT', 'OPS']))).toBe(
      'Used by 12 projects; 2 have their own version (PLT, OPS) and keep them. Changes here reach the other 10.',
    );
    expect(usageSentence(usage(2, ['PLT']))).toBe(
      'Used by 2 projects; 1 has its own version (PLT) and keeps it. Changes here reach the other one.',
    );
  });

  it('counts rather than lists many projects, and says when none follow', () => {
    expect(usageSentence(usage(4, ['A', 'B', 'C', 'D']))).toBe(
      'Used by 4 projects; 4 have their own version and keep them. Changes here reach new projects only.',
    );
  });
});
