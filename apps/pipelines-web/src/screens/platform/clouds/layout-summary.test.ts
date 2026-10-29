import { describe, expect, it } from 'vitest';
import { summarize } from './layout-summary.ts';

const environments = [
  { name: 'Dev', class: 'dev' as const },
  { name: 'Staging', class: 'staging' as const },
  { name: 'Prod', class: 'prod' as const },
];

describe('what each layout creates', () => {
  it('Starter: the platform project and one per tier', () => {
    expect(summarize('starter', environments, 4)).toMatchObject({ projects: 3, created: 2 });
    expect(summarize('starter', environments.slice(0, 1), 4)).toMatchObject({ projects: 2 });
  });

  it('Standard: control, CI and one per environment', () => {
    expect(summarize('per-environment', environments, 4)).toMatchObject({
      projects: 5,
      created: 4,
    });
  });

  it('Enterprise: control, CI and one per domain and environment', () => {
    expect(summarize('per-domain-environment', environments, 4)).toMatchObject({
      projects: 14,
      created: 13,
    });
  });
});
