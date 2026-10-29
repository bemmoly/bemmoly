import { describe, expect, it } from 'vitest';
import type { GcpTransport } from '../../../clients/gcp/index.ts';
import { createReplayTransport, fixedTokens, loadFixture } from '../../../testing/gcp-replay.ts';
import type { ConnectionRecord, MachineLaunch } from '../contract.ts';
import { createGcpProvider } from './index.ts';

/*
 * Cloud Build as a one-job build machine, against recorded answers: a build starts with the
 * runner image and the launch token as a substitution, its state is read back and mapped to
 * neutral words, and cancelling works on a running build and is quiet on one that ended.
 */

const connection: ConnectionRecord = {
  id: '0199f0aa-0000-7000-8000-0000000000b1',
  provider: 'gcp',
  name: 'Nila Google Cloud',
  layout: 'per-environment',
  boundaryRef: null,
  config: { mode: 'attached', region: 'europe-west1', credentials: { kind: 'metadata' } },
};

const TOKEN = 'bpl_recorded-launch-token-for-tests';
const RUNNING = '6c1f0b52-3e0d-4a7c-9d41-2f8a7e5b9c10';
const FAILED = '0b9e7d34-51aa-4c02-8f6e-a3c2d1e0f9b8';
const account = { externalId: 'nila-ci', config: {} };
const place = { account, region: 'europe-west1' };

const launch = (overrides: Partial<MachineLaunch> = {}): MachineLaunch => ({
  account,
  region: 'europe-west1',
  image: 'europe-west1-docker.pkg.dev/nila-ci/bemmoly/runner:1.7.0',
  machineType: 'e2-highcpu-8',
  serviceAccount: 'builder@nila-ci.iam.gserviceaccount.com',
  controlPlaneUrl: 'https://bemmoly.nila.example',
  launchToken: TOKEN,
  timeoutMinutes: 75,
  labels: { pool: 'cloud-build', job: '0199f0bb-1111-7000-8000-000000000001', run: 'r' },
  ...overrides,
});

function recording() {
  const replay = createReplayTransport(loadFixture('cloud-build'));
  const bodies: unknown[] = [];
  const transport: GcpTransport = (url, init) => {
    if (init.body) bodies.push(JSON.parse(init.body));
    return replay.transport(url, init);
  };
  const runners = createGcpProvider({ transport, tokensFor: () => fixedTokens() }).runners;
  if (!runners?.launch || !runners.status || !runners.cancel) throw new Error('no runners part');
  return {
    runners: { ...runners, launch: runners.launch, status: runners.status, cancel: runners.cancel },
    replay,
    bodies,
  };
}

describe('Cloud Build build machines', () => {
  it('starts one build running the runner image, with the token kept out of its args', async () => {
    const { runners, replay, bodies } = recording();
    const started = await runners.launch(connection, launch());
    expect(started).toEqual({
      ref: RUNNING,
      logUrl: expect.stringContaining(`/cloud-build/builds;region=europe-west1/${RUNNING}`),
    });
    const body = bodies[0] as {
      steps: Array<{ name: string; args?: string[]; env: string[] }>;
      tags: string[];
    };
    expect(body.steps).toHaveLength(1);
    expect(body.steps[0]?.name).toBe('europe-west1-docker.pkg.dev/nila-ci/bemmoly/runner:1.7.0');
    expect(body.steps[0]?.args).toBeUndefined();
    expect(body.steps[0]?.env).toContain('BEMMOLY_LAUNCH_TOKEN=$_BEMMOLY_LAUNCH_TOKEN');
    expect(body.steps[0]?.env).toContain('BEMMOLY_URL=https://bemmoly.nila.example');
    expect(JSON.stringify(body.steps)).not.toContain(TOKEN);
    expect(body.tags).toEqual([
      'bemmoly',
      'pool-cloud-build',
      'job-0199f0bb-1111-7000-8000-000000000001',
    ]);
    replay.verify();
  });

  it('reads a build back as queued, working, failed with Google reason, or gone', async () => {
    const { runners, replay } = recording();
    expect(await runners.status(connection, { ...place, ref: RUNNING })).toEqual({
      state: 'working',
      detail: null,
    });
    const failed = await runners.status(connection, { ...place, ref: FAILED });
    expect(failed.state).toBe('failed');
    expect(failed.detail).toMatch(/^Build step failure: build step 0/);
    expect(
      await runners.status(connection, { ...place, ref: '1d2e3f40-0000-4000-8000-00000000dead' }),
    ).toEqual({ state: 'gone', detail: 'Cloud Build has no build with this id any more' });
    replay.verify();
  });

  it('cancels a working build and says nothing when the build had already ended', async () => {
    const { runners, replay } = recording();
    await runners.cancel(connection, { ...place, ref: RUNNING });
    await runners.cancel(connection, { ...place, ref: FAILED });
    expect(replay.calls).toEqual([
      `POST /v1/projects/nila-ci/locations/europe-west1/builds/${RUNNING}:cancel`,
      `POST /v1/projects/nila-ci/locations/europe-west1/builds/${FAILED}:cancel`,
    ]);
    replay.verify();
  });

  it('says what to check when Google refuses to start the build', async () => {
    const { runners } = recording();
    await expect(
      runners.launch(
        connection,
        launch({
          account: { externalId: 'nila-locked', config: {} },
          serviceAccount: 'builder@nila-locked.iam.gserviceaccount.com',
        }),
      ),
    ).rejects.toThrow(
      /^Cloud Build would not start a build in nila-locked: The caller does not have permission .*Check that the Cloud Build API is on there/,
    );
  });
});
