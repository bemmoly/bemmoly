import type { SetupStep, SetupStepKey } from '@bemmoly/module-pipelines/shared';

/*
 * Where each checklist step is done and its words. Every finished step comes back here
 * (useReturnToChecklist), so the person always picks the next one from this list.
 */

export const STEP_PLACE: Record<SetupStepKey, string> = {
  cloud: '/setup/cloud',
  environments: '/environments',
  people: '/platform/people',
  services: '/services',
  pipelines: '/services',
  templates: '/platform/templates',
};

export const STEP_WORDS = {
  cloud: [
    'pipelinesSetup.step.cloud',
    'pipelinesSetup.step.cloudText',
    'pipelinesSetup.step.cloudAction',
  ],
  environments: [
    'pipelinesSetup.step.environments',
    'pipelinesSetup.step.environmentsText',
    'pipelinesSetup.step.environmentsAction',
  ],
  people: [
    'pipelinesSetup.step.people',
    'pipelinesSetup.step.peopleText',
    'pipelinesSetup.step.peopleAction',
  ],
  services: [
    'pipelinesSetup.step.services',
    'pipelinesSetup.step.servicesText',
    'pipelinesSetup.step.servicesAction',
  ],
  pipelines: [
    'pipelinesSetup.step.pipelines',
    'pipelinesSetup.step.pipelinesText',
    'pipelinesSetup.step.pipelinesAction',
  ],
  templates: [
    'pipelinesSetup.step.templates',
    'pipelinesSetup.step.templatesText',
    'pipelinesSetup.step.templatesAction',
  ],
} as const satisfies Record<SetupStepKey, readonly [string, string, string]>;

export const NEEDS_WORDS = {
  cloud: 'pipelinesSetup.needs.cloud',
  environments: 'pipelinesSetup.needs.environments',
  people: 'pipelinesSetup.needs.people',
  services: 'pipelinesSetup.needs.services',
  pipelines: 'pipelinesSetup.needs.pipelines',
  templates: 'pipelinesSetup.needs.templates',
} as const satisfies Record<SetupStepKey, string>;

/** The first step that can be done now, the one whose button is the primary one. */
export function nextStep(steps: readonly SetupStep[]): SetupStepKey | null {
  return steps.find((step) => !step.done && !step.blockedBy)?.key ?? null;
}

/** Setup pages: where "Back to the checklist" shows while setup is under way. */
export function isSetupPage(path: string): boolean {
  return (
    path.startsWith('/setup') ||
    path.startsWith('/environments') ||
    path.startsWith('/services') ||
    ['/platform/people', '/platform/templates', '/platform/clouds', '/platform/approvals'].some(
      (place) => path.startsWith(place),
    )
  );
}
