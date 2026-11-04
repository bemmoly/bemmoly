import { describe, expect, it } from 'vitest';
import { bodyOf, countOf, draftFor, draftReady, problemOf, projectFor } from './suggested-draft.ts';

const PROJECTS = ['example-tools', 'example-dev', 'example-stage', 'example-prod'];
const group = (name: string) => `${name} approvers`;

describe('the suggested setup', () => {
  it('picks the project whose ID names the environment', () => {
    expect(projectFor('stage', PROJECTS)).toBe('example-stage');
    expect(projectFor('prod', ['one', 'two', 'three'])).toBe('three');
    expect(projectFor('dev', [])).toBe('');
  });

  it('counts only ticks that still apply', () => {
    const draft = draftFor(PROJECTS);
    expect(countOf(draft)).toBe(5);
    draft.ticks.prod = false;
    // Production's approval goes with Production.
    expect(countOf(draft)).toBe(3);
  });

  it('builds equal environments in order, with the approval and window ticked', () => {
    const draft = draftFor(PROJECTS);
    draft.ticks.window = true;
    draft.env.prod.name = 'Live';
    draft.env.prod.id = 'live';
    const body = bodyOf(draft, group, 'UTC');
    expect(body.environments.map((e) => [e.key, e.versionsAllowed])).toEqual([
      ['dev', 'any'],
      ['stage', 'passed_previous'],
      ['live', 'passed_previous'],
    ]);
    expect(body.environments[2]).toMatchObject({
      name: 'Live',
      project: { externalId: 'example-prod' },
      approval: { groupName: 'Live approvers', count: 1 },
      window: { from: '10:00', to: '18:00', timeZone: 'UTC' },
    });
    expect(body.environments[0]?.approval).toBeNull();
  });

  it('refuses two environments with one ID, or an ID pipeline files cannot use', () => {
    const draft = draftFor(PROJECTS);
    draft.env.stage.id = 'dev';
    expect(problemOf(draft, 'stage')).toBe('taken');
    expect(draftReady(draft)).toBe(false);
    draft.env.stage.id = 'Stage One';
    expect(problemOf(draft, 'stage')).toBe('id');
  });
});
