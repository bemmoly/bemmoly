import { describe, expect, it } from 'vitest';
import { managedBodyOf, managedReady, type ManagedDraft } from './managed-form.ts';

const draft: ManagedDraft = {
  name: 'Acme Google Cloud',
  folderId: 'folders/417302018845',
  billingAccountId: '01a2b3-c4d5e6-f7a8b9',
  controlProject: 'bemmoly-control-583920174411',
  region: 'us-central1',
  signIn: 'vm',
  credentialFile: null,
};

describe('the Create projects for me form', () => {
  it('is ready with what bootstrap.sh printed, and sends Starter by default', () => {
    expect(managedReady(draft)).toBe(true);
    expect(managedBodyOf(draft)).toEqual({
      provider: 'gcp',
      mode: 'managed',
      layout: 'starter',
      name: 'Acme Google Cloud',
      folderId: 'folders/417302018845',
      billingAccountId: '01A2B3-C4D5E6-F7A8B9',
      controlProject: 'bemmoly-control-583920174411',
      region: 'us-central1',
      signIn: 'vm',
    });
  });

  it('waits for a valid folder, billing account and control project', () => {
    expect(managedReady({ ...draft, folderId: 'Bemmoly' })).toBe(false);
    expect(managedReady({ ...draft, billingAccountId: '01A2B3' })).toBe(false);
    expect(managedReady({ ...draft, controlProject: 'Bad_Project' })).toBe(false);
    expect(managedReady({ ...draft, signIn: 'workload_identity_file' })).toBe(false);
  });
});
