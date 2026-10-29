import {
  gcpRegionSchema,
  registryPathSchema,
  type ConnectCloudBody,
} from '@bemmoly/module-pipelines/shared';

/*
 * The attached Google Cloud form's rules, apart from its drawing: what each field accepts and
 * the body it sends. An attached connection creates nothing, so it asks for no organisation,
 * billing account or folder.
 */

export type SignIn = 'vm' | 'application_default' | 'workload_identity_file';

export const SIGN_INS: readonly SignIn[] = ['vm', 'application_default', 'workload_identity_file'];

export interface AttachedDraft {
  name: string;
  region: string;
  signIn: SignIn;
  /** The workload identity file, already read and parsed in the browser. */
  credentialFile: Record<string, unknown> | null;
  registry: string;
}

export type CredentialRead =
  | { ok: true; file: Record<string, unknown> }
  | { ok: false; reason: 'not_json' | 'service_account_key' | 'not_federation' };

/**
 * A workload identity file is an external_account JSON. A service account key looks alike but
 * is a long-lived secret, and Bemmoly never takes one, so it is turned away before it is sent.
 */
export function readCredential(text: string): CredentialRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not_json' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'not_json' };
  }
  const type = (parsed as Record<string, unknown>)['type'];
  if (type === 'service_account') return { ok: false, reason: 'service_account_key' };
  if (type !== 'external_account') return { ok: false, reason: 'not_federation' };
  return { ok: true, file: parsed as Record<string, unknown> };
}

export const regionValid = (region: string) => gcpRegionSchema.safeParse(region.trim()).success;

/** Empty is fine: the registry is optional. */
export const registryValid = (registry: string) =>
  !registry.trim() || registryPathSchema.safeParse(registry).success;

export function attachedReady(draft: AttachedDraft): boolean {
  return (
    draft.name.trim().length > 0 &&
    regionValid(draft.region) &&
    registryValid(draft.registry) &&
    (draft.signIn !== 'workload_identity_file' || draft.credentialFile !== null)
  );
}

export function attachedBodyOf(draft: AttachedDraft): ConnectCloudBody {
  const registry = draft.registry.trim();
  return {
    provider: 'gcp',
    mode: 'attached',
    name: draft.name.trim(),
    region: draft.region.trim(),
    signIn: draft.signIn,
    ...(draft.signIn === 'workload_identity_file' && draft.credentialFile
      ? { credentialFile: draft.credentialFile }
      : {}),
    ...(registry ? { registry } : {}),
  };
}
