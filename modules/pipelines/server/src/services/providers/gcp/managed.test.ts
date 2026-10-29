import { describe, expect, it } from 'vitest';
import {
  createReplayTransport,
  fixedTokens,
  loadFixture,
  type RecordedExchange,
} from '../../../testing/gcp-replay.ts';
import { ApplyStopped, type ConnectionRecord, type DesiredResource } from '../contract.ts';
import { createGcpProvider } from './index.ts';

/*
 * Managed mode as a real organisation would see it, against hand-written answers: the folder
 * grant checked permission by permission, the billing account counted, a project creation
 * stopped by the billing quota and resumed without creating anything twice, and the
 * bootstrap's control project adopted as it is.
 */

const connection: ConnectionRecord = {
  id: '0199f0aa-0000-7000-8000-000000000004',
  provider: 'gcp',
  name: 'Acme Google Cloud',
  layout: 'starter',
  boundaryRef: 'folders/417302018845',
  config: {
    mode: 'managed',
    folderId: '417302018845',
    billingAccountId: '01A2B3-C4D5E6-F7A8B9',
    controlProject: 'bemmoly-control-583920174411',
  },
};

function replaying(...fixtures: RecordedExchange[][]) {
  const replay = createReplayTransport(...fixtures);
  const provider = createGcpProvider({
    transport: replay.transport,
    tokensFor: () => fixedTokens(),
    poll: { intervalMs: 0, sleep: async () => {} },
  });
  return { replay, provider };
}

const need = <T>(part: T | undefined): T => {
  if (!part) throw new Error('part missing');
  return part;
};

const projectResource = (spec: Record<string, unknown>, account = 'acme-nonprod-7c1e') =>
  ({ kind: 'account', name: account, account, spec, dependsOn: [] }) as DesiredResource;

const nonprod = projectResource({
  displayName: 'Non-production',
  folder: null,
  labels: { class: 'dev', environment: 'nonprod' },
});

describe('the folder grant', () => {
  it('passes when the folder and the billing account grant exactly what is needed', async () => {
    const { replay, provider } = replaying(loadFixture('managed-check-ok'));
    const check = await need(provider.connection).verify(connection);
    expect(check).toMatchObject({ ok: true, problems: [] });
    replay.verify({ allUsed: true });
  });

  it('says, one sentence each, which role to grant and where', async () => {
    const { replay, provider } = replaying(loadFixture('managed-check-missing'));
    const check = await need(provider.connection).verify(connection);
    expect(check.ok).toBe(false);
    const who = 'bemmoly-control@bemmoly-control-583920174411.iam.gserviceaccount.com';
    expect(check.problems).toEqual([
      `Grant ${who} Folder Creator (roles/resourcemanager.folderCreator) on folder 417302018845, so the Enterprise layout can make a folder per domain`,
      `Grant ${who} Billing Account User (roles/billing.user) on billing account 01A2B3-C4D5E6-F7A8B9, so new projects can be linked to it`,
    ]);
    // The folder is never looked for or made under the organisation.
    expect(replay.calls.some((call) => call.includes('organizations/'))).toBe(false);
    replay.verify({ allUsed: true });
  });

  it('uses the folder bootstrap.sh made as the boundary, without creating one', async () => {
    const { replay, provider } = replaying([]);
    const unplaced = { ...connection, boundaryRef: null };
    expect(await need(provider.org).ensureBoundary(unplaced, 'Bemmoly')).toEqual({
      ref: 'folders/417302018845',
    });
    expect(replay.calls).toEqual([]);
  });
});

describe('the billing check', () => {
  it('counts every project the billing account pays for, page by page', async () => {
    const { replay, provider } = replaying(loadFixture('managed-billing'));
    expect(await need(need(provider.org).billing)(connection)).toEqual({
      account: '01A2B3-C4D5E6-F7A8B9',
      linked: 3,
      limit: 5,
      recorded: false,
    });
    replay.verify({ allUsed: true });
  });

  it('compares against a limit an admin recorded', async () => {
    const { provider } = replaying(loadFixture('managed-billing'));
    const recorded = { ...connection, config: { ...connection.config, projectQuota: 25 } };
    expect(await need(need(provider.org).billing)(recorded)).toMatchObject({
      limit: 25,
      recorded: true,
    });
  });
});

describe('applying a project, stopped and resumed', () => {
  it('stops with what to ask Google for when the billing quota refuses the link', async () => {
    const { replay, provider } = replaying(loadFixture('managed-apply-quota'));
    const zone = need(provider.landingZone);
    expect(await zone.read(connection, nonprod)).toBeNull();
    const failure = await zone.apply(connection, nonprod).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApplyStopped);
    expect((failure as Error).message).toBe(
      'Billing account 01A2B3-C4D5E6-F7A8B9 cannot pay for more projects. Ask Google for more at https://support.google.com/code/contact/billing_quota_increase, then choose Retry',
    );
    replay.verify({ allUsed: true });
  });

  it('on retry finds the project it made and only links billing', async () => {
    const { replay, provider } = replaying(loadFixture('managed-apply-retry'));
    const zone = need(provider.landingZone);
    const seen = await zone.read(connection, nonprod);
    expect(zone.diff(nonprod, seen ?? {})).toEqual(['billing is false, wanted true']);
    const observed = await zone.apply(connection, nonprod);
    expect(zone.diff(nonprod, observed)).toEqual([]);
    expect(replay.calls.filter((call) => call === 'POST /v3/projects')).toEqual([]);
    expect(replay.calls.filter((call) => call.startsWith('PATCH'))).toEqual([]);
    replay.verify({ allUsed: true });
  });
});

describe('the control project bootstrap.sh made', () => {
  const control = (account: string) =>
    projectResource(
      {
        displayName: 'Bemmoly platform',
        folder: null,
        labels: { purpose: 'control' },
        adopt: true,
      },
      account,
    );

  it('is adopted as it is: billed, and its labels left alone', async () => {
    const { replay, provider } = replaying(loadFixture('managed-adopt'));
    const zone = need(provider.landingZone);
    const resource = control('bemmoly-control-583920174411');
    expect(zone.diff(resource, (await zone.read(connection, resource)) ?? {})).toEqual([]);
    const missing = control('bemmoly-control-gone');
    expect(await zone.read(connection, missing)).toBeNull();
    await expect(zone.apply(connection, missing)).rejects.toThrow(/Run deploy\/gcp\/bootstrap.sh/);
    replay.verify({ allUsed: true });
  });
});
