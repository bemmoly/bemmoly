import {
  billingAccountIdPattern,
  folderIdSchema,
  gcpRegionSchema,
} from '@bemmoly/module-pipelines/shared';

/*
 * The values the guided steps fill their commands with, apart from their drawing. Each value
 * is what the person typed or, until they type, a suggestion they can see and change; nothing
 * is filled in that is not on screen.
 */

export type GuideField =
  | 'organizationId'
  | 'billingAccountId'
  | 'folderName'
  | 'controlProject'
  | 'region'
  | 'folderId'
  | 'you'
  | 'principal'
  | 'serviceAccount'
  | 'vmName'
  | 'vmZone'
  | 'vmProject';

export type GuideValues = Record<GuideField, string>;

/** Only what the person typed; a field they never touched is absent. */
export type GuideDraft = Partial<GuideValues>;

const PROJECT = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const SERVICE_ACCOUNT =
  /^[a-z][a-z0-9-]{4,28}[a-z0-9]@([a-z][a-z0-9-]{4,28}[a-z0-9])\.iam\.gserviceaccount\.com$/;

const VALID: Record<GuideField, (value: string) => boolean> = {
  organizationId: (value) => /^[0-9]{6,20}$/.test(value),
  billingAccountId: (value) => billingAccountIdPattern.test(value.toUpperCase()),
  // Google Cloud's rule for a folder's display name.
  folderName: (value) => /^[A-Za-z0-9]([A-Za-z0-9 _-]{0,28}[A-Za-z0-9])?$/.test(value),
  controlProject: (value) => PROJECT.test(value),
  region: (value) => gcpRegionSchema.safeParse(value).success,
  folderId: (value) => folderIdSchema.safeParse(value).success,
  you: (value) => /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(value),
  principal: (value) => value.includes('@') && !/["`$\\]/.test(value),
  serviceAccount: (value) => SERVICE_ACCOUNT.test(value),
  vmName: (value) => /^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$/.test(value),
  vmZone: (value) => /^[a-z]+-[a-z]+[0-9]+-[a-z]$/.test(value),
  vmProject: (value) => PROJECT.test(value),
};

export const fieldValid = (field: GuideField, value: string) => VALID[field](value.trim());

/** The project a service account lives in, when its email says. */
export function projectOfAccount(email: string | null): string | null {
  const match = email ? SERVICE_ACCOUNT.exec(email.trim()) : null;
  return match?.[1] ?? null;
}

const isServiceAccount = (email: string) => email.endsWith('.gserviceaccount.com');

export interface SuggestFrom {
  /** Who Bemmoly signs in as right now, if the sign-in works already. */
  principal: string | null;
  signIn: 'vm' | 'application_default' | 'workload_identity_file' | null;
  /** The first project picked under "What Bemmoly can reach". */
  firstProject: string | null;
  draft: GuideDraft;
}

/** Suggestions only: each shows in its field, marked as one, until the person types there. */
export function suggestionsOf({ principal, signIn, firstProject, draft }: SuggestFrom): GuideDraft {
  const out: GuideDraft = { folderName: 'Bemmoly Pipelines', region: 'us-central1' };
  const runsIn = signIn === 'vm' ? projectOfAccount(principal) : null;
  const org = draft.organizationId?.trim();
  if (runsIn) out.controlProject = runsIn;
  else if (org && fieldValid('organizationId', org)) out.controlProject = `bemmoly-control-${org}`;
  const control = draft.controlProject ?? out.controlProject;
  if (runsIn || control) out.vmProject = runsIn ?? control;
  if (principal) out.principal = principal;
  if (principal && signIn === 'application_default' && !isServiceAccount(principal)) {
    out.you = principal;
  }
  if (principal && projectOfAccount(principal)) out.serviceAccount = principal;
  else if (firstProject) out.serviceAccount = `bemmoly@${firstProject}.iam.gserviceaccount.com`;
  return out;
}

export function valuesOf(draft: GuideDraft, suggested: GuideDraft): GuideValues {
  const value = (field: GuideField) => (draft[field] ?? suggested[field] ?? '').trim();
  return {
    organizationId: value('organizationId'),
    billingAccountId: value('billingAccountId').toUpperCase(),
    folderName: value('folderName'),
    controlProject: value('controlProject'),
    region: value('region'),
    folderId: value('folderId').replace(/^folders\//, ''),
    you: value('you'),
    principal: value('principal'),
    serviceAccount: value('serviceAccount'),
    vmName: value('vmName'),
    vmZone: value('vmZone'),
    vmProject: value('vmProject'),
  };
}
