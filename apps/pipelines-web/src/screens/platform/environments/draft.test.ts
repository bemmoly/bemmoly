import type { CloudAccount, CloudConnection, Environment } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import {
  changesOf,
  createBodyOf,
  draftOf,
  draftReady,
  groupReadyAccounts,
  keyOf,
  NEW_DRAFT,
  protectionOf,
} from './draft.ts';

const environment: Environment = {
  id: 'e1',
  key: 'shop-prod',
  name: 'Shop prod',
  class: 'prod',
  provider: 'gcp',
  region: null,
  position: 3,
  cloudAccount: { id: 'a1', externalId: 'acme-shop-prod', name: 'Shop' },
  protection: { protected: true, controlPlaneOnly: false, requiresApproval: true, window: null },
  defaultRuntime: 'cloud-run',
};

describe('a new environment', () => {
  it('takes its key from the name until the key is typed', () => {
    expect(keyOf({ ...NEW_DRAFT, name: 'Shop Prod' })).toBe('shop-prod');
    expect(keyOf({ ...NEW_DRAFT, name: 'Shop Prod', key: 'shop' })).toBe('shop');
  });

  it('protects Prod and asks for an approval unless told otherwise', () => {
    expect(protectionOf({ ...NEW_DRAFT, class: 'prod' })).toEqual({
      protected: true,
      requiresApproval: true,
    });
    expect(protectionOf({ ...NEW_DRAFT, class: 'dev' })).toEqual({
      protected: false,
      requiresApproval: false,
    });
    const override = { protected: true, requiresApproval: false };
    expect(protectionOf({ ...NEW_DRAFT, class: 'prod', protection: override })).toEqual(override);
  });

  it('defaults the region to the project connection and sends what is shown', () => {
    const draft = { ...NEW_DRAFT, name: 'Shop prod', class: 'prod' as const, accountId: 'a1' };
    expect(createBodyOf(draft, 'europe-west1')).toEqual({
      key: 'shop-prod',
      name: 'Shop prod',
      class: 'prod',
      provider: 'gcp',
      cloudAccountId: 'a1',
      region: 'europe-west1',
      protection: { protected: true, requiresApproval: true },
      defaultRuntime: 'cloud-run',
    });
    expect(createBodyOf({ ...draft, region: '' }, 'europe-west1').region).toBeNull();
  });

  it('is ready with a name, a valid key and a valid region', () => {
    expect(draftReady(NEW_DRAFT, null)).toBe(false);
    expect(draftReady({ ...NEW_DRAFT, name: 'Shop' }, null)).toBe(true);
    expect(draftReady({ ...NEW_DRAFT, name: 'Shop', key: 'Bad Key' }, null)).toBe(false);
    expect(draftReady({ ...NEW_DRAFT, name: 'Shop', region: 'Europe West' }, null)).toBe(false);
  });
});

describe('an edit', () => {
  it('sends nothing when nothing changed', () => {
    expect(changesOf(environment, draftOf(environment))).toEqual({});
  });

  it('sends only what changed', () => {
    const draft = {
      ...draftOf(environment),
      name: 'Shop production ',
      region: 'us-east1',
      protection: { protected: true, requiresApproval: false },
    };
    expect(changesOf(environment, draft)).toEqual({
      name: 'Shop production',
      region: 'us-east1',
      protection: { protected: true, requiresApproval: false },
    });
    expect(changesOf(environment, { ...draftOf(environment), accountId: null })).toEqual({
      cloudAccountId: null,
    });
  });
});

describe('groupReadyAccounts', () => {
  const connection = (id: string, name: string, region: string | null) =>
    ({ id, name, region }) as CloudConnection;
  const account = (id: string, status: CloudAccount['status'], purpose = 'workload') =>
    ({ id, externalId: id, name: `Project ${id}`, status, purpose }) as CloudAccount;

  it('keeps ready workload projects, grouped by connection, with its region', () => {
    const groups = groupReadyAccounts([
      {
        connection: connection('c1', 'Acme Google Cloud', null),
        accounts: [account('acme-dev', 'ready'), account('acme-ci', 'ready', 'ci')],
      },
      {
        connection: connection('c2', 'Shop', 'europe-west1'),
        accounts: [account('acme-shop-prod', 'ready'), account('acme-broken', 'failed')],
      },
      { connection: connection('c3', 'Empty', null), accounts: [account('x', 'creating')] },
    ]);
    expect(groups).toEqual([
      {
        connection: 'Acme Google Cloud',
        accounts: [
          { id: 'acme-dev', externalId: 'acme-dev', name: 'Project acme-dev', region: null },
        ],
      },
      {
        connection: 'Shop',
        accounts: [
          {
            id: 'acme-shop-prod',
            externalId: 'acme-shop-prod',
            name: 'Project acme-shop-prod',
            region: 'europe-west1',
          },
        ],
      },
    ]);
  });
});
