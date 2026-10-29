import {
  billingAccountIdPattern,
  folderIdSchema,
  type ConnectCloudBody,
} from '@bemmoly/module-pipelines/shared';
import { regionValid, type SignIn } from './attached-form.ts';

/*
 * The "Create projects for me" form's rules, apart from its drawing. It asks for what
 * bootstrap.sh printed: the folder Pipelines may work in, the billing account that pays for
 * new projects and the control project Bemmoly runs in. No organisation: the grant is on the
 * folder alone.
 */

export interface ManagedDraft {
  name: string;
  folderId: string;
  billingAccountId: string;
  controlProject: string;
  region: string;
  signIn: SignIn;
  credentialFile: Record<string, unknown> | null;
}

const PROJECT = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export const folderValid = (value: string) => folderIdSchema.safeParse(value).success;
export const billingValid = (value: string) =>
  billingAccountIdPattern.test(value.trim().toUpperCase());
export const projectValid = (value: string) => PROJECT.test(value.trim());

export function managedReady(draft: ManagedDraft): boolean {
  return (
    draft.name.trim().length > 0 &&
    folderValid(draft.folderId) &&
    billingValid(draft.billingAccountId) &&
    projectValid(draft.controlProject) &&
    regionValid(draft.region) &&
    (draft.signIn !== 'workload_identity_file' || draft.credentialFile !== null)
  );
}

export function managedBodyOf(draft: ManagedDraft): ConnectCloudBody {
  return {
    provider: 'gcp',
    mode: 'managed',
    layout: 'starter',
    name: draft.name.trim(),
    folderId: draft.folderId.trim(),
    billingAccountId: draft.billingAccountId.trim().toUpperCase(),
    controlProject: draft.controlProject.trim(),
    region: draft.region.trim(),
    signIn: draft.signIn,
    ...(draft.signIn === 'workload_identity_file' && draft.credentialFile
      ? { credentialFile: draft.credentialFile }
      : {}),
  };
}
