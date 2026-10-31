import type { KubernetesManifest } from '../../../clients/kubernetes/index.ts';
import { RUNNER_POD_ENV, type RunnerPod } from '../../../../../shared/autopilot.ts';
import type { MachineLaunch, PodLaunch, PodPoolSite, PodSize } from '../runners-contract.ts';
import { LABELS, MANAGED_BY } from './gke-manifests.ts';

/*
 * What a GKE Autopilot runner pool writes. Per pool: its namespace and the Kubernetes service
 * account its pods run as, tied to a Google service account by Workload Identity, and, when
 * it keeps room warm, a Deployment of pause pods at the lowest priority that any job's pod
 * takes the place of. Per job: a Job with one pod, and a Secret with its launch token.
 *
 * The pod has the runner, plus one container per step image and one for image builds, all
 * sharing two volumes. Those containers are native sidecars, so they stop when the runner
 * exits and the pod ends with it. Each runs a small agent that runs what the runner hands it
 * through a folder. Autopilot allows no privileged pod, so there is no Docker daemon to
 * start step containers on demand: every image a job needs is in its pod from the start.
 */

export const RUNNER_SERVICE_ACCOUNT = 'bemmoly-runner';
export const WARM_ROOM = 'bemmoly-warm-room';
export const WARM_PRIORITY_CLASS = 'bemmoly-warm-room';
export const PAUSE_IMAGE = 'registry.k8s.io/pause:3.10';
/** Autopilot gives a pod at most 25 seconds to stop on Spot capacity. */
const SPOT_GRACE_SECONDS = 25;
const JOB_TTL_SECONDS = 600;

export const POOL_LABEL = 'pipelines.bemmoly.dev/pool';
export const JOB_LABEL = 'pipelines.bemmoly.dev/job';
export const RUN_LABEL = 'pipelines.bemmoly.dev/run';

const CONTROL = '/bemmoly/control';
const WORK = '/bemmoly/work';
export const RUNNER_POD_PATHS = {
  control: CONTROL,
  logs: `${WORK}/logs`,
  dataDir: `${WORK}/runner`,
  agent: `${CONTROL}/agent.sh`,
  /** Where the runner image keeps the agent; the first container copies it to `agent`. */
  agentInImage: '/app/apps/runner/agent/step-agent.sh',
} as const;

/**
 * What the runner container and the agent copy ask for; each step container asks for the
 * pool's size. Disk: the shared work volume counts against the pod's total, which is the sum
 * of what its containers ask for, and Kaniko unpacks base images in its own container.
 */
const RUNNER_ASK = { cpu: '250m', memory: '512Mi', 'ephemeral-storage': '4Gi' };
const AGENT_ASK = { cpu: '50m', memory: '64Mi', 'ephemeral-storage': '50Mi' };
const STEP_DISK = '1Gi';
const BUILD_DISK = '3Gi';
const WORK_DISK = '4Gi';

export const cpuOf = (cpu: number) => `${Math.round(cpu * 1000)}m`;
export const memoryOf = (gb: number) => `${Math.round(gb * 1024)}Mi`;

const managed = (pool: string) => ({ [LABELS.managedBy]: MANAGED_BY, [POOL_LABEL]: pool });

export function poolNamespaceManifest(site: PodPoolSite): KubernetesManifest {
  return { kind: 'Namespace', metadata: { name: site.namespace, labels: managed(site.pool) } };
}

export function runnerServiceAccountManifest(site: PodPoolSite): KubernetesManifest {
  return {
    kind: 'ServiceAccount',
    metadata: {
      name: RUNNER_SERVICE_ACCOUNT,
      namespace: site.namespace,
      labels: managed(site.pool),
      annotations: { 'iam.gke.io/gcp-service-account': site.serviceAccount },
    },
  };
}

/** The Workload Identity member the pods' service account maps to. */
export const workloadMember = (workloadPool: string, namespace: string) =>
  `serviceAccount:${workloadPool}[${namespace}/${RUNNER_SERVICE_ACCOUNT}]`;

const spotPlacement = (size: PodSize) =>
  size.spot
    ? {
        nodeSelector: { 'cloud.google.com/gke-spot': 'true' },
        terminationGracePeriodSeconds: SPOT_GRACE_SECONDS,
      }
    : {};

/** Below every pod's default priority, and never pushing another pod out. */
export const warmPriorityClassManifest = (): KubernetesManifest => ({
  kind: 'PriorityClass',
  metadata: { name: WARM_PRIORITY_CLASS, labels: { [LABELS.managedBy]: MANAGED_BY } },
  value: -10,
  preemptionPolicy: 'Never',
  globalDefault: false,
  description: 'Room Bemmoly keeps warm for runner pods; any runner pod takes its place.',
});

export function warmRoomManifest(site: PodPoolSite): KubernetesManifest {
  const labels = { ...managed(site.pool), 'app.kubernetes.io/name': WARM_ROOM };
  return {
    kind: 'Deployment',
    metadata: { name: WARM_ROOM, namespace: site.namespace, labels },
    spec: {
      replicas: site.warm,
      selector: { matchLabels: { 'app.kubernetes.io/name': WARM_ROOM } },
      template: {
        metadata: { labels },
        spec: {
          priorityClassName: WARM_PRIORITY_CLASS,
          terminationGracePeriodSeconds: 0,
          automountServiceAccountToken: false,
          ...spotPlacement(site.size),
          containers: [
            {
              name: 'room',
              image: PAUSE_IMAGE,
              resources: {
                requests: { cpu: cpuOf(site.size.cpu), memory: memoryOf(site.size.memoryGb) },
              },
            },
          ],
        },
      },
    },
  };
}

/** "step-0" for each image in order, and "build" when the job builds an image. */
export function podLayout(pod: PodLaunch): RunnerPod {
  return {
    control: RUNNER_POD_PATHS.control,
    logs: RUNNER_POD_PATHS.logs,
    steps: Object.fromEntries(pod.stepImages.map((image, index) => [image, `step-${index}`])),
    builder: pod.builderImage ? 'build' : null,
  };
}

const mounts = [
  { name: 'control', mountPath: CONTROL },
  { name: 'work', mountPath: WORK },
];

function agentContainer(name: string, image: string, size: PodSize, shell: string) {
  const ask = {
    cpu: cpuOf(size.cpu),
    memory: memoryOf(size.memoryGb),
    'ephemeral-storage': name === 'build' ? BUILD_DISK : STEP_DISK,
  };
  return {
    name,
    image,
    // A native sidecar: it starts before the runner and stops when the runner exits.
    restartPolicy: 'Always',
    command: [
      shell,
      RUNNER_POD_PATHS.agent,
      `${CONTROL}/${name}`,
      `${RUNNER_POD_PATHS.logs}/${name}`,
    ],
    volumeMounts: mounts,
    resources: { requests: ask, limits: ask },
  };
}

export const tokenSecretName = (job: string) => `${job}-token`;

/** One job's pod: the runner, an agent per step image, and Kaniko when it builds. */
export function runnerJobManifest(
  launch: MachineLaunch,
  pod: PodLaunch,
  name: string,
): KubernetesManifest {
  const layout = podLayout(pod);
  const labels = {
    ...managed(launch.labels.pool),
    [JOB_LABEL]: launch.labels.job,
    [RUN_LABEL]: launch.labels.run,
  };
  const sidecars = [
    ...pod.stepImages.map((image, index) => agentContainer(`step-${index}`, image, pod.size, 'sh')),
    // Kaniko's debug image keeps its shell in /busybox.
    ...(pod.builderImage
      ? [agentContainer('build', pod.builderImage, pod.size, '/busybox/sh')]
      : []),
  ];
  return {
    kind: 'Job',
    metadata: { name, namespace: pod.namespace, labels },
    spec: {
      backoffLimit: 0,
      activeDeadlineSeconds: launch.timeoutMinutes * 60,
      ttlSecondsAfterFinished: JOB_TTL_SECONDS,
      template: {
        metadata: { labels },
        spec: {
          restartPolicy: 'Never',
          serviceAccountName: RUNNER_SERVICE_ACCOUNT,
          ...spotPlacement(pod.size),
          initContainers: [
            {
              name: 'agent',
              image: launch.image,
              command: ['cp', RUNNER_POD_PATHS.agentInImage, RUNNER_POD_PATHS.agent],
              volumeMounts: mounts,
              resources: { requests: AGENT_ASK, limits: AGENT_ASK },
            },
            ...sidecars,
          ],
          containers: [
            {
              name: 'runner',
              image: launch.image,
              env: [
                { name: 'BEMMOLY_URL', value: launch.controlPlaneUrl },
                {
                  name: 'BEMMOLY_LAUNCH_TOKEN',
                  valueFrom: { secretKeyRef: { name: tokenSecretName(name), key: 'token' } },
                },
                { name: 'BEMMOLY_RUNNER_NAME', value: `gke-${launch.labels.job.slice(0, 8)}` },
                { name: 'BEMMOLY_RUNNER_DATA_DIR', value: RUNNER_POD_PATHS.dataDir },
                { name: RUNNER_POD_ENV, value: JSON.stringify(layout) },
              ],
              volumeMounts: mounts,
              resources: { requests: RUNNER_ASK, limits: RUNNER_ASK },
            },
          ],
          volumes: [
            // Scripts and each step's environment, secrets included, stay in memory.
            { name: 'control', emptyDir: { medium: 'Memory', sizeLimit: '64Mi' } },
            { name: 'work', emptyDir: { sizeLimit: WORK_DISK } },
          ],
        },
      },
    },
  };
}

export function tokenSecretManifest(
  namespace: string,
  job: { name: string; uid: string },
  token: string,
  pool: string,
): KubernetesManifest {
  return {
    kind: 'Secret',
    metadata: {
      name: tokenSecretName(job.name),
      namespace,
      labels: managed(pool),
      ownerReferences: [{ apiVersion: 'batch/v1', kind: 'Job', name: job.name, uid: job.uid }],
    },
    type: 'Opaque',
    stringData: { token },
  };
}
