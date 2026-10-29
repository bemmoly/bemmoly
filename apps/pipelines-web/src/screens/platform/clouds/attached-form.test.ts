import { describe, expect, it } from 'vitest';
import {
  attachedBodyOf,
  attachedReady,
  readCredential,
  type AttachedDraft,
} from './attached-form.ts';

const draft = (patch: Partial<AttachedDraft> = {}): AttachedDraft => ({
  name: 'Google Cloud',
  region: 'us-central1',
  signIn: 'vm',
  credentialFile: null,
  registry: '',
  ...patch,
});

describe('readCredential', () => {
  it('takes a workload identity file', () => {
    const read = readCredential('{"type":"external_account","audience":"//iam"}');
    expect(read).toEqual({ ok: true, file: { type: 'external_account', audience: '//iam' } });
  });

  it('turns away a service account key, other JSON and text that is not JSON', () => {
    expect(readCredential('{"type":"service_account"}')).toEqual({
      ok: false,
      reason: 'service_account_key',
    });
    expect(readCredential('{"type":"authorized_user"}')).toEqual({
      ok: false,
      reason: 'not_federation',
    });
    expect(readCredential('[1]')).toEqual({ ok: false, reason: 'not_json' });
    expect(readCredential('nope')).toEqual({ ok: false, reason: 'not_json' });
  });
});

describe('attachedReady', () => {
  it('needs a name, a region and, for the file sign-in, the file', () => {
    expect(attachedReady(draft())).toBe(true);
    expect(attachedReady(draft({ name: ' ' }))).toBe(false);
    expect(attachedReady(draft({ region: 'central' }))).toBe(false);
    expect(attachedReady(draft({ signIn: 'workload_identity_file' }))).toBe(false);
    expect(attachedReady(draft({ registry: 'not a registry' }))).toBe(false);
  });
});

describe('attachedBodyOf', () => {
  it('sends an attached body with only what was given', () => {
    expect(attachedBodyOf(draft({ registry: ' us-central1-docker.pkg.dev/acme/apps ' }))).toEqual({
      provider: 'gcp',
      mode: 'attached',
      name: 'Google Cloud',
      region: 'us-central1',
      signIn: 'vm',
      registry: 'us-central1-docker.pkg.dev/acme/apps',
    });
  });

  it('sends the file only with the file sign-in', () => {
    const file = { type: 'external_account' };
    expect(attachedBodyOf(draft({ credentialFile: file }))).not.toHaveProperty('credentialFile');
    expect(
      attachedBodyOf(draft({ signIn: 'workload_identity_file', credentialFile: file })),
    ).toMatchObject({ credentialFile: file });
  });
});
