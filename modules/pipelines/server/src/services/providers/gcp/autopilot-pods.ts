import { createHash } from 'node:crypto';
import { ProviderError } from '@bemmoly/shared';
import { KubernetesApiError, type KubernetesObject } from '../../../clients/kubernetes/index.ts';
import type { MachineStatus, RunnersPart } from '../runners-contract.ts';
import { clusterPathOf, parsePodRef, poolRefOf, type PodAccess } from './autopilot-access.ts';
import { runnerJobManifest, tokenSecretManifest, tokenSecretName } from './autopilot-manifests.ts';

/*
 * One runner pod per job on a GKE Autopilot pool: a Kubernetes Job that runs once, with its
 * launch token in a Secret the Job owns, so deleting the Job takes the pod and the token with
 * it. The Job is written first and the Secret second, because the Secret names the Job's uid;
 * the pod waits the moment between. Its state is read from the Job and its pod, and an image
 * GKE cannot pull ends it, since it would otherwise wait until the job's timeout.
 */

const PULL_FAILED = new Set(['ErrImagePull', 'ImagePullBackOff', 'InvalidImageName']);

interface Condition {
  type?: string;
  status?: string;
  reason?: string;
  message?: string;
}

interface ContainerState {
  name?: string;
  image?: string;
  state?: {
    waiting?: { reason?: string; message?: string };
    terminated?: { reason?: string; exitCode?: number; message?: string };
  };
}

const conditionsOf = (job: KubernetesObject) =>
  (job.status?.['conditions'] as Condition[] | undefined) ?? [];

const containersOf = (pod: KubernetesObject): ContainerState[] => [
  ...((pod.status?.['initContainerStatuses'] as ContainerState[] | undefined) ?? []),
  ...((pod.status?.['containerStatuses'] as ContainerState[] | undefined) ?? []),
];

/** Why the pod could not start or stopped early, in GKE's words; null when it says nothing. */
function podTrouble(pod: KubernetesObject | undefined): string | null {
  if (!pod) return null;
  for (const container of containersOf(pod)) {
    const waiting = container.state?.waiting;
    if (waiting?.reason && PULL_FAILED.has(waiting.reason)) {
      return `GKE could not pull ${container.image ?? container.name ?? 'an image'}: ${waiting.message ?? waiting.reason}`;
    }
  }
  const message = pod.status?.['message'];
  if (typeof message === 'string' && message) return message;
  const runner = containersOf(pod).find((container) => container.name === 'runner');
  const ended = runner?.state?.terminated;
  if (ended && ended.exitCode !== 0) {
    return `The runner exited with ${ended.exitCode ?? 'an error'}${ended.reason ? ` (${ended.reason})` : ''}`;
  }
  return null;
}

/** Each launch has its own token, so a few of its hash's digits tell two pods for one job apart. */
const suffixOf = (token: string) => createHash('sha256').update(token).digest('hex').slice(0, 6);

export function createAutopilotPods(
  access: PodAccess,
): Required<Pick<RunnersPart, 'launch' | 'status' | 'cancel'>> {
  return {
    async launch(connection, input) {
      const pod = input.pod;
      if (!pod) throw new Error('A runner pod needs its pool');
      const project = input.account.externalId;
      const { location, name: cluster } = pod.cluster;
      const path = clusterPathOf(project, location, cluster);
      const { kube } = await access.open(connection, input.account, path);
      const name = `bemmoly-${input.labels.job}-${suffixOf(input.launchToken)}`;
      let job: KubernetesObject;
      try {
        job = await kube.apply(runnerJobManifest(input, pod, name));
      } catch (error) {
        if (error instanceof KubernetesApiError && [400, 403, 422].includes(error.status)) {
          throw new ProviderError(
            `GKE would not start a runner pod in ${pod.namespace} on ${cluster}: ${error.message}. Check the pool in Platform › Capacity`,
          );
        }
        throw error;
      }
      try {
        const uid = job.metadata.uid;
        if (!uid) throw new Error(`GKE answered for Job ${name} without its uid`);
        await kube.apply(
          tokenSecretManifest(pod.namespace, { name, uid }, input.launchToken, input.labels.pool),
        );
      } catch (error) {
        await kube.remove('Job', name, pod.namespace).catch(() => undefined);
        throw error;
      }
      return {
        ref: `${poolRefOf(path, pod.namespace)}/jobs/${name}`,
        logUrl: `https://console.cloud.google.com/kubernetes/job/${location}/${cluster}/${pod.namespace}/${name}/details?project=${project}`,
      };
    },

    async status(connection, input): Promise<MachineStatus> {
      const ref = parsePodRef(input.ref);
      if (!ref?.job) return { state: 'gone', detail: 'This is not a runner pod Pipelines started' };
      const { kube } = await access.open(connection, input.account, ref.cluster);
      const job = await kube.get('Job', ref.job, ref.namespace);
      if (!job) return { state: 'gone', detail: 'GKE has no runner pod for this job any more' };
      const conditions = conditionsOf(job);
      const met = (type: string) => conditions.find((c) => c.type === type && c.status === 'True');
      if (met('Complete')) return { state: 'succeeded', detail: null };
      const pods = await kube.list('Pod', ref.namespace, `job-name=${ref.job}`);
      const failed = met('Failed');
      if (failed) {
        return {
          state: 'failed',
          detail: podTrouble(pods[0]) ?? failed.message ?? failed.reason ?? 'The runner pod failed',
        };
      }
      const pod = pods[0];
      const trouble = podTrouble(pod);
      if (trouble && pod?.status?.['phase'] !== 'Running')
        return { state: 'failed', detail: trouble };
      const phase = pod?.status?.['phase'];
      if (phase === 'Running') return { state: 'working', detail: null };
      if (phase === 'Succeeded') return { state: 'succeeded', detail: null };
      if (phase === 'Failed')
        return { state: 'failed', detail: trouble ?? 'The runner pod failed' };
      return { state: 'queued', detail: null };
    },

    async cancel(connection, input) {
      const ref = parsePodRef(input.ref);
      if (!ref?.job) return;
      const { kube } = await access.open(connection, input.account, ref.cluster);
      // Deleting the Job deletes its pod; the token goes too, and is removed here in case.
      await kube.remove('Job', ref.job, ref.namespace);
      await kube.remove('Secret', tokenSecretName(ref.job), ref.namespace);
    },
  };
}
