import { grantCommand } from '@bemmoly/module-pipelines/shared';
import {
  attachVmCommand,
  bootstrapCommand,
  COMPOSE_OVERRIDE,
  controlEmail,
  serviceAccountCommand,
  signInCommand,
  tokenCreatorCommand,
} from './guide-commands.ts';
import { fieldValid, projectOfAccount, type GuideField, type GuideValues } from './guide-values.ts';
import type { ReachRead } from './reach-draft.ts';

/*
 * The numbered steps for one choice of mode and sign-in. Each step names the fields it asks
 * for and every value its command uses; until all of them are valid it has no command, so a
 * command with a missing argument is never shown.
 */

export type ConnectMode = 'attached' | 'managed';
export type GuideSignIn = 'vm' | 'application_default' | 'workload_identity_file';

export type StepKey =
  | 'bootstrap'
  | 'tokenCreator'
  | 'serviceAccount'
  | 'signIn'
  | 'docker'
  | 'attachVm'
  | 'wifFile'
  | 'folderId'
  | 'grant';

/** Where the command runs: Cloud Shell, a terminal here, beside the compose file, or nowhere. */
export type StepWhere = 'cloudShell' | 'thisMachine' | 'compose' | 'here';

/** What a step still needs: a field, or the reach chosen inside the grant step. */
export type StepNeed = GuideField | 'reach';

export interface GuideStep {
  key: StepKey;
  /** The fields drawn in this step; others it uses were asked for in an earlier one. */
  asks: GuideField[];
  /** What is not valid yet, in the order the step uses it. */
  missing: StepNeed[];
  command: string | null;
  where: StepWhere;
  /** Shown as "only if": the Docker step. */
  optional?: boolean;
}

export interface GuideInput {
  mode: ConnectMode;
  signIn: GuideSignIn;
  values: GuideValues;
  reach: ReachRead;
}

function step(
  key: StepKey,
  where: StepWhere,
  asks: GuideField[],
  uses: StepNeed[],
  input: GuideInput,
  render: (() => string) | null,
  optional = false,
): GuideStep {
  const missing = uses.filter((need) =>
    need === 'reach' ? !input.reach.ok : !fieldValid(need, input.values[need]),
  );
  const command = render && missing.length === 0 ? render() : null;
  return { key, asks, missing, command, where, ...(optional ? { optional } : {}) };
}

const BOOTSTRAP: GuideField[] = [
  'organizationId',
  'billingAccountId',
  'folderName',
  'controlProject',
  'region',
];

function managedSteps(input: GuideInput): GuideStep[] {
  const v = input.values;
  const control = () => controlEmail(v.controlProject);
  const first = step('bootstrap', 'cloudShell', BOOTSTRAP, BOOTSTRAP, input, () =>
    bootstrapCommand(v),
  );
  const folder = step('folderId', 'here', ['folderId'], ['folderId'], input, null);
  if (input.signIn === 'vm') {
    const vm: GuideField[] = ['vmName', 'vmZone', 'vmProject'];
    return [
      first,
      step('attachVm', 'cloudShell', vm, [...vm, 'controlProject'], input, () =>
        attachVmCommand({ ...v, account: control() }),
      ),
      folder,
    ];
  }
  if (input.signIn === 'workload_identity_file') {
    return [first, step('wifFile', 'here', [], [], input, null), folder];
  }
  return [
    first,
    step('tokenCreator', 'cloudShell', ['you'], ['controlProject', 'you'], input, () =>
      tokenCreatorCommand(control(), v.controlProject, v.you),
    ),
    step('signIn', 'thisMachine', [], ['controlProject'], input, () => signInCommand(control())),
    step('docker', 'compose', [], [], input, () => COMPOSE_OVERRIDE, true),
    folder,
  ];
}

function attachedSteps(input: GuideInput): GuideStep[] {
  const v = input.values;
  if (input.signIn === 'application_default') {
    const project = () => projectOfAccount(v.serviceAccount) ?? '';
    return [
      step(
        'serviceAccount',
        'cloudShell',
        ['serviceAccount', 'you'],
        ['serviceAccount', 'you'],
        input,
        () => serviceAccountCommand(v.serviceAccount, project(), v.you),
      ),
      step('signIn', 'thisMachine', [], ['serviceAccount'], input, () =>
        signInCommand(v.serviceAccount),
      ),
      step('docker', 'compose', [], [], input, () => COMPOSE_OVERRIDE, true),
      step('grant', 'cloudShell', [], ['reach', 'serviceAccount'], input, () =>
        input.reach.ok ? grantCommand(input.reach.reach, v.serviceAccount) : '',
      ),
    ];
  }
  const grant = step('grant', 'cloudShell', ['principal'], ['reach', 'principal'], input, () =>
    input.reach.ok ? grantCommand(input.reach.reach, v.principal) : '',
  );
  if (input.signIn === 'workload_identity_file') {
    return [step('wifFile', 'here', [], [], input, null), grant];
  }
  return [grant];
}

export function guideSteps(input: GuideInput): GuideStep[] {
  return input.mode === 'managed' ? managedSteps(input) : attachedSteps(input);
}

/**
 * Who Bemmoly should sign in as once the steps are done, so Check can say when it is someone
 * else; null when the steps leave it to the file or the person.
 */
export function expectedPrincipal(input: GuideInput): string | null {
  const v = input.values;
  if (input.mode === 'managed') {
    if (input.signIn === 'workload_identity_file') return null;
    return fieldValid('controlProject', v.controlProject) ? controlEmail(v.controlProject) : null;
  }
  if (input.signIn === 'application_default') {
    return fieldValid('serviceAccount', v.serviceAccount) ? v.serviceAccount : null;
  }
  return fieldValid('principal', v.principal) ? v.principal : null;
}
