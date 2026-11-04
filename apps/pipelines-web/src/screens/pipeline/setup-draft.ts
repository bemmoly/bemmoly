import type {
  BuiltInTemplateKey,
  BuiltInTemplateSummary,
  PipelineStart,
  PipelineStore,
  SavePipelineSetupBody,
  VersionScheme,
} from '@bemmoly/module-pipelines/shared';

/*
 * The three choices of "Set up a pipeline", as the form holds them. Nothing is chosen at
 * first; "Use suggested" only fills the form, and the person still presses Create.
 */

export interface SetupDraft {
  start: PipelineStart | null;
  template: BuiltInTemplateKey | null;
  repositoryFile: string | null;
  store: PipelineStore | null;
  versionScheme: VersionScheme | null;
}

export const EMPTY_DRAFT: SetupDraft = {
  start: null,
  template: null,
  repositoryFile: null,
  store: null,
  versionScheme: null,
};

export const VERSION_SCHEMES: readonly VersionScheme[] = [
  'semver_commits',
  'build_number',
  'git_tag',
  'commit',
];

/** The suggested choices: the suggested template, kept in Bemmoly, versions from commits. */
export function suggestedDraft(templates: readonly BuiltInTemplateSummary[]): SetupDraft {
  const template = templates.find((item) => item.suggested) ?? templates[0];
  return {
    start: 'template',
    template: template?.key ?? null,
    repositoryFile: null,
    store: 'bemmoly',
    versionScheme: 'semver_commits',
  };
}

export function isReady(draft: SetupDraft): boolean {
  if (!draft.start || !draft.store || !draft.versionScheme) return false;
  if (draft.start === 'template') return draft.template !== null;
  if (draft.start === 'repository') return draft.repositoryFile !== null;
  return true;
}

export function toBody(draft: SetupDraft): Omit<SavePipelineSetupBody, 'triggers'> | null {
  if (!isReady(draft) || !draft.start || !draft.store || !draft.versionScheme) return null;
  return {
    start: draft.start,
    store: draft.store,
    versionScheme: draft.versionScheme,
    ...(draft.start === 'template' && draft.template ? { template: draft.template } : {}),
    ...(draft.start === 'repository' && draft.repositoryFile
      ? { repositoryFile: draft.repositoryFile }
      : {}),
  };
}
