import { describe, expect, it } from 'vitest';
import { GRANT_ROLES } from '@bemmoly/module-pipelines/shared';
import { expectedPrincipal, guideSteps, type GuideInput } from './guide-steps.ts';
import { suggestionsOf, valuesOf, type GuideDraft } from './guide-values.ts';
import { readReach, type ReachDraft } from './reach-draft.ts';

const NO_REACH: ReachDraft = { kind: null, folder: '', projects: '' };

function input(
  mode: GuideInput['mode'],
  signIn: GuideInput['signIn'],
  draft: GuideDraft,
  reach: ReachDraft = NO_REACH,
  principal: string | null = null,
): GuideInput {
  const read = readReach(reach);
  const firstProject =
    read.ok && read.reach.kind === 'projects' ? (read.reach.projects[0] ?? null) : null;
  const suggested = suggestionsOf({ principal, signIn, firstProject, draft });
  return { mode, signIn, values: valuesOf(draft, suggested), reach: read };
}

const LAPTOP: GuideDraft = {
  organizationId: '583920174411',
  billingAccountId: '01a2b3-c4d5e6-f7a8b9',
  you: 'keerthi@example.com',
  folderId: '417302018845',
};

const VALUED =
  /--(org|billing|folder-name|control-project|region|mode|project|member|role|zone|service-account|scopes|impersonate-service-account)(?:=|\s+)(\S*)/g;

/** Every flag that takes a value has one, and no `=` is followed by a space or the end. */
function complete(command: string) {
  for (const [, flag, value] of command.matchAll(VALUED)) {
    expect(value, `--${flag}`).toMatch(/^[^-\\\s]/);
  }
  expect(command).not.toMatch(/=(\s|$)/m);
  expect(command).not.toMatch(/BEMMOLY_SIGNS_IN_AS|PROJECT_ID|undefined|[=:@ ]null\b/);
}

describe('the guided connect steps', () => {
  it('shows no command while any value it uses is missing or wrong', () => {
    const cases: GuideInput[] = [
      input('managed', 'application_default', {}),
      input('managed', 'application_default', { ...LAPTOP, billingAccountId: 'not-billing' }),
      input('managed', 'vm', { ...LAPTOP, vmName: 'Bad Name' }),
      input('attached', 'vm', {}),
      input('attached', 'application_default', { you: 'me@example.com' }),
      input('attached', 'workload_identity_file', { principal: 'x@y' }),
    ];
    for (const guide of cases) {
      for (const step of guideSteps(guide)) {
        if (step.missing.length > 0) expect(step.command).toBeNull();
        if (step.command !== null) complete(step.command);
      }
    }
  });

  it('creates projects from a laptop: bootstrap, Token Creator, impersonate, Docker, folder', () => {
    const guide = input('managed', 'application_default', LAPTOP);
    const steps = guideSteps(guide);
    expect(steps.map((step) => step.key)).toEqual([
      'bootstrap',
      'tokenCreator',
      'signIn',
      'docker',
      'folderId',
    ]);
    const [bootstrap, token, signIn, docker] = steps;
    expect(bootstrap?.command).toContain(
      "--org 583920174411 --billing 01A2B3-C4D5E6-F7A8B9 \\\n  --folder-name 'Bemmoly Pipelines' --control-project bemmoly-control-583920174411",
    );
    expect(bootstrap?.command).toContain('--region us-central1 --mode none');
    const account = 'bemmoly-control@bemmoly-control-583920174411.iam.gserviceaccount.com';
    expect(token?.command).toContain(`add-iam-policy-binding ${account}`);
    expect(token?.command).toContain('--member=user:keerthi@example.com');
    expect(signIn?.command).toBe(
      `gcloud auth application-default login --impersonate-service-account=${account}`,
    );
    expect(signIn?.where).toBe('thisMachine');
    expect(docker?.optional).toBe(true);
    expect(docker?.command).toContain('/var/bemmoly/gcloud:ro');
    expect(docker?.command).toContain('GOOGLE_APPLICATION_CREDENTIALS');
    for (const step of steps) expect(step.missing).toEqual([]);
    expect(expectedPrincipal(guide)).toBe(account);
  });

  it('waits for the person in step 2 before granting Token Creator', () => {
    const steps = guideSteps(input('managed', 'application_default', { ...LAPTOP, you: '' }));
    expect(steps[1]?.missing).toEqual(['you']);
    expect(steps[1]?.command).toBeNull();
    expect(steps[2]?.command).not.toBeNull();
  });

  it('creates projects from a Google Cloud VM: bootstrap, attach bemmoly-control, folder', () => {
    const steps = guideSteps(
      input('managed', 'vm', { ...LAPTOP, vmName: 'bemmoly', vmZone: 'us-central1-a' }),
    );
    expect(steps.map((step) => step.key)).toEqual(['bootstrap', 'attachVm', 'folderId']);
    expect(steps[1]?.command).toContain(
      'set-service-account bemmoly --zone=us-central1-a --project=bemmoly-control-583920174411',
    );
    expect(steps[1]?.command).toContain('--scopes=cloud-platform');
  });

  it('suggests where Bemmoly runs as the control project, never over what was typed', () => {
    const vm = 'bemmoly-vm@acme-tools.iam.gserviceaccount.com';
    expect(
      suggestionsOf({ principal: vm, signIn: 'vm', firstProject: null, draft: {} }),
    ).toMatchObject({
      controlProject: 'acme-tools',
      vmProject: 'acme-tools',
      principal: vm,
    });
    const typed = { controlProject: 'my-control' };
    const suggested = suggestionsOf({
      principal: vm,
      signIn: 'vm',
      firstProject: null,
      draft: typed,
    });
    expect(valuesOf(typed, suggested).controlProject).toBe('my-control');
  });

  it('attaches projects with the grant for exactly the reach and the account', () => {
    const reach: ReachDraft = {
      kind: 'projects',
      folder: '',
      projects: 'example-dev example-prod',
    };
    const vm = guideSteps(
      input('attached', 'vm', {}, reach, 'bemmoly@acme-tools.iam.gserviceaccount.com'),
    );
    expect(vm.map((step) => step.key)).toEqual(['grant']);
    expect(vm[0]?.command).toContain('for PROJECT in example-dev example-prod; do');
    expect(vm[0]?.command).toContain(GRANT_ROLES[0]);
    expect(vm[0]?.command).toContain('serviceAccount:bemmoly@acme-tools.iam.gserviceaccount.com');

    const laptop = guideSteps(
      input('attached', 'application_default', { you: 'me@example.com' }, reach),
    );
    expect(laptop.map((step) => step.key)).toEqual(['serviceAccount', 'signIn', 'docker', 'grant']);
    expect(laptop[0]?.command).toContain(
      'gcloud iam service-accounts create bemmoly --project=example-dev',
    );
    expect(laptop[3]?.command).toContain(
      'serviceAccount:bemmoly@example-dev.iam.gserviceaccount.com',
    );

    const noReach = guideSteps(
      input('attached', 'vm', { principal: 'bemmoly@acme-tools.iam.gserviceaccount.com' }),
    );
    expect(noReach[0]?.missing).toEqual(['reach']);
    expect(noReach[0]?.command).toBeNull();
  });

  it('keeps the workload identity file as its own step', () => {
    const managed = guideSteps(input('managed', 'workload_identity_file', LAPTOP));
    expect(managed.map((step) => step.key)).toEqual(['bootstrap', 'wifFile', 'folderId']);
    const attached = guideSteps(input('attached', 'workload_identity_file', {}));
    expect(attached.map((step) => step.key)).toEqual(['wifFile', 'grant']);
  });
});
