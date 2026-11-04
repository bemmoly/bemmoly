import { describe, expect, it } from 'vitest';
import { EMPTY_DRAFT, isReady, suggestedDraft, toBody } from './setup-draft.ts';

const templates = [
  { key: 'one-environment', suggested: false },
  { key: 'dev-stage-production', suggested: true },
] as never;

describe('the pipeline setup form', () => {
  it('starts with nothing chosen and cannot be created until all three are', () => {
    expect(isReady(EMPTY_DRAFT)).toBe(false);
    expect(toBody(EMPTY_DRAFT)).toBeNull();
    expect(
      isReady({ ...EMPTY_DRAFT, start: 'template', store: 'bemmoly', versionScheme: 'commit' }),
    ).toBe(false);
  });

  it('fills the suggested choices, which the person then confirms', () => {
    const draft = suggestedDraft(templates);
    expect(draft).toMatchObject({
      start: 'template',
      template: 'dev-stage-production',
      store: 'bemmoly',
    });
    expect(toBody(draft)).toEqual({
      start: 'template',
      template: 'dev-stage-production',
      store: 'bemmoly',
      versionScheme: 'semver_commits',
    });
  });

  it('sends only the choice that applies to how it starts', () => {
    const body = toBody({
      start: 'repository',
      template: 'one-environment',
      repositoryFile: '.github/workflows/deploy.yml',
      store: 'repository',
      versionScheme: 'git_tag',
    });
    expect(body).toEqual({
      start: 'repository',
      repositoryFile: '.github/workflows/deploy.yml',
      store: 'repository',
      versionScheme: 'git_tag',
    });
  });
});
