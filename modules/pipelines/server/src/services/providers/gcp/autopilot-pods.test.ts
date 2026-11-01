import { describe, expect, it } from 'vitest';
import {
  account,
  clusterAnswer,
  JOB_NAME,
  KUBE,
  LAUNCH_TOKEN,
  managed,
  NAMESPACE,
  POD_REF,
  podLaunch,
  recordingRunners,
  RUNNER_IMAGE,
  site,
} from '../../../testing/autopilot-fixture.ts';
import { loadFixture } from '../../../testing/gcp-replay.ts';

/*
 * One runner pod per job on a GKE Autopilot pool, against recorded answers: the Job holds the
 * runner and a container per step image and for image builds, the launch token lives only in
 * a Secret the Job owns, the pod's state is read back in neutral words, and cancelling
 * deletes the Job and its token.
 */

const place = { account, region: 'europe-west1', ref: POD_REF };

interface PodSpec {
  initContainers: Array<{ name: string; image: string; restartPolicy?: string; command: string[] }>;
  containers: Array<{ name: string; env: Array<{ name: string; value?: string }> }>;
  nodeSelector?: Record<string, string>;
  terminationGracePeriodSeconds?: number;
  serviceAccountName: string;
}

describe('runner pods on GKE Autopilot', () => {
  it('starts one Job per job with every step image beside the runner and the token in a Secret', async () => {
    const { runners, replay, bodies } = recordingRunners(loadFixture('gke-runner-pools'));
    await runners.ensurePool(managed, site());
    await runners.readPool(managed, { ...place, ref: POD_REF.split('/jobs/')[0] ?? '' });
    const started = await runners.launch(managed, podLaunch());
    expect(started).toEqual({
      ref: POD_REF,
      logUrl: `https://console.cloud.google.com/kubernetes/job/europe-west1/bemmoly-runners/${NAMESPACE}/${JOB_NAME}/details?project=nila-ci`,
    });
    const job = bodies.find((call) => call.url.includes('/jobs/'))?.body as {
      spec: { template: { spec: PodSpec } };
    };
    const pod = job.spec.template.spec;
    expect(pod.initContainers.map((c) => [c.name, c.image, c.restartPolicy])).toEqual([
      ['agent', RUNNER_IMAGE, undefined],
      ['step-0', 'node:24', 'Always'],
      ['step-1', 'alpine:3.20', 'Always'],
      ['build', 'gcr.io/kaniko-project/executor:v1.23.2-debug', 'Always'],
    ]);
    expect(pod.initContainers[3]?.command[0]).toBe('/busybox/sh');
    expect(pod.serviceAccountName).toBe('bemmoly-runner');
    expect(pod.nodeSelector).toEqual({ 'cloud.google.com/gke-spot': 'true' });
    expect(pod.terminationGracePeriodSeconds).toBe(25);
    const env = Object.fromEntries(
      (pod.containers[0]?.env ?? []).map((entry) => [entry.name, entry.value ?? '(secret)']),
    );
    expect(env).toMatchObject({
      BEMMOLY_URL: 'https://bemmoly.nila.example',
      BEMMOLY_LAUNCH_TOKEN: '(secret)',
      BEMMOLY_RUNNER_NAME: 'gke-0199f0bb',
    });
    expect(JSON.parse(env['BEMMOLY_RUNNER_POD'] ?? '{}')).toEqual({
      control: '/bemmoly/control',
      logs: '/bemmoly/work/logs',
      steps: { 'node:24': 'step-0', 'alpine:3.20': 'step-1' },
      builder: 'build',
    });
    expect(JSON.stringify(job)).not.toContain(LAUNCH_TOKEN);
    expect(await runners.status(managed, place)).toEqual({ state: 'working', detail: null });
    expect(await runners.status(managed, place)).toEqual({ state: 'succeeded', detail: null });
    await runners.cancel(managed, place);
    replay.verify({ allUsed: true });
  });

  it('ends a pod whose image GKE cannot pull, and reads a deleted Job as gone', async () => {
    const { runners, replay } = recordingRunners([
      clusterAnswer(),
      {
        method: 'GET',
        url: `${KUBE}/apis/batch/v1/namespaces/${NAMESPACE}/jobs/${JOB_NAME}`,
        response: { metadata: { name: JOB_NAME }, status: { active: 1 } },
      },
      {
        method: 'GET',
        url: `${KUBE}/api/v1/namespaces/${NAMESPACE}/pods`,
        response: {
          items: [
            {
              metadata: { name: `${JOB_NAME}-q9z1m` },
              status: {
                phase: 'Pending',
                initContainerStatuses: [
                  {
                    name: 'step-0',
                    image: 'node:24-typo',
                    state: {
                      waiting: {
                        reason: 'ImagePullBackOff',
                        message: 'Back-off pulling image "node:24-typo"',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        method: 'GET',
        url: `${KUBE}/apis/batch/v1/namespaces/${NAMESPACE}/jobs/${JOB_NAME}`,
        status: 404,
        response: { kind: 'Status', reason: 'NotFound' },
      },
    ]);
    expect(await runners.status(managed, place)).toEqual({
      state: 'failed',
      detail: 'GKE could not pull node:24-typo: Back-off pulling image "node:24-typo"',
    });
    expect(await runners.status(managed, place)).toEqual({
      state: 'gone',
      detail: 'GKE has no runner pod for this job any more',
    });
    replay.verify({ allUsed: true });
  });

  it('gives the reason a Spot pod was taken back', async () => {
    const { runners } = recordingRunners([
      clusterAnswer(),
      {
        method: 'GET',
        url: `${KUBE}/apis/batch/v1/namespaces/${NAMESPACE}/jobs/${JOB_NAME}`,
        response: {
          metadata: { name: JOB_NAME },
          status: {
            failed: 1,
            conditions: [
              {
                type: 'Failed',
                status: 'True',
                reason: 'BackoffLimitExceeded',
                message: 'Job has reached the specified backoff limit',
              },
            ],
          },
        },
      },
      {
        method: 'GET',
        url: `${KUBE}/api/v1/namespaces/${NAMESPACE}/pods`,
        response: {
          items: [
            {
              metadata: { name: `${JOB_NAME}-q9z1m` },
              status: {
                phase: 'Failed',
                reason: 'Terminated',
                message: 'Pod was terminated in response to imminent node shutdown.',
              },
            },
          ],
        },
      },
    ]);
    expect(await runners.status(managed, place)).toEqual({
      state: 'failed',
      detail: 'Pod was terminated in response to imminent node shutdown.',
    });
  });

  it('says what to check when GKE refuses the pod, and leaves no Job behind a failed Secret', async () => {
    const refused = recordingRunners([
      clusterAnswer(),
      {
        method: 'PATCH',
        url: `${KUBE}/apis/batch/v1/namespaces/${NAMESPACE}/jobs/${JOB_NAME}`,
        status: 422,
        response: {
          kind: 'Status',
          reason: 'Invalid',
          message:
            'admission webhook "gkepolicy.common-webhooks.networking.gke.io" denied the request',
        },
      },
    ]);
    await expect(refused.runners.launch(managed, podLaunch())).rejects.toThrow(
      /^GKE would not start a runner pod in runners-gke on bemmoly-runners: admission webhook .*Check the pool in Platform › Capacity$/,
    );
    const halfway = recordingRunners([
      clusterAnswer(),
      {
        method: 'PATCH',
        url: `${KUBE}/apis/batch/v1/namespaces/${NAMESPACE}/jobs/${JOB_NAME}`,
        response: { metadata: { name: JOB_NAME, uid: '3f9a6c1e-8d2b-4e57-b0a4-6c5d4e3f2a10' } },
      },
      {
        method: 'PATCH',
        url: `${KUBE}/api/v1/namespaces/${NAMESPACE}/secrets/${JOB_NAME}-token`,
        status: 403,
        response: { kind: 'Status', reason: 'Forbidden', message: 'secrets is forbidden' },
      },
      {
        method: 'DELETE',
        url: `${KUBE}/apis/batch/v1/namespaces/${NAMESPACE}/jobs/${JOB_NAME}`,
        response: { kind: 'Status', status: 'Success' },
      },
    ]);
    await expect(halfway.runners.launch(managed, podLaunch())).rejects.toThrow(
      /secrets is forbidden/,
    );
    halfway.replay.verify({ allUsed: true });
  });
});
