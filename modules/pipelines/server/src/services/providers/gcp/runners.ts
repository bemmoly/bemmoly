import { ProviderError } from '@bemmoly/shared';
import { GcpApiError, type GcpClients } from '../../../clients/gcp/index.ts';
import type { MachineRef, MachineStatus, RunnersPart } from '../contract.ts';
import { createPodAccess, parsePodRef, type PodAccessOptions } from './autopilot-access.ts';
import { createAutopilotPods } from './autopilot-pods.ts';
import { createAutopilotPools } from './autopilot-pools.ts';
import { accountConfigOf, type GcpContexts } from './context.ts';

/*
 * Build machines for one job each. On Cloud Build (journeys proposal: the first day, no
 * cluster) each job is one build with one step: the runner image in one-job mode. The launch
 * token goes in as a substitution read into the step's env, so it never appears in the
 * step's args; it registers once and the runner it makes ends with its job. On a GKE
 * Autopilot pool each job is one pod instead (autopilot-pods.ts), and its ref says so.
 */

const MACHINE_TYPES: Readonly<Record<string, string>> = {
  'e2-medium': 'E2_MEDIUM',
  'e2-highcpu-8': 'E2_HIGHCPU_8',
  'e2-highcpu-32': 'E2_HIGHCPU_32',
  'n1-highcpu-8': 'N1_HIGHCPU_8',
  'n1-highcpu-32': 'N1_HIGHCPU_32',
};

const STATES: Readonly<Record<string, MachineStatus['state']>> = {
  PENDING: 'queued',
  QUEUED: 'queued',
  WORKING: 'working',
  STATUS_UNKNOWN: 'working',
  SUCCESS: 'succeeded',
  FAILURE: 'failed',
  INTERNAL_ERROR: 'failed',
  TIMEOUT: 'failed',
  EXPIRED: 'failed',
  CANCELLED: 'cancelled',
};

const ENDED_WHY: Readonly<Record<string, string>> = {
  TIMEOUT: 'The build ran past its timeout',
  EXPIRED: 'The build waited in the Cloud Build queue too long and expired',
  INTERNAL_ERROR: 'Cloud Build had an internal error',
  CANCELLED: 'The build was cancelled in Google Cloud',
};

/** The data folder sits in /workspace so step containers that share its volume see the job. */
export const CLOUD_BUILD_DATA_DIR = '/workspace/.bemmoly-runner';
export const LAUNCH_TOKEN_SUBSTITUTION = '_BEMMOLY_LAUNCH_TOKEN';

/** Tags allow letters, digits, dots, dashes and underscores. */
const tag = (value: string) => value.replace(/[^\w.-]/g, '-').slice(0, 120);

export function createGcpRunners(
  contexts: GcpContexts,
  options: PodAccessOptions = {},
): RunnersPart {
  const access = createPodAccess(contexts, options);
  const pools = createAutopilotPools(contexts, access);
  const pods = createAutopilotPods(access);

  /** Created projects start builds as the control identity; attached ones as their deployer. */
  function clientsFor(
    connection: Parameters<GcpContexts>[0],
    account: MachineRef['account'],
  ): GcpClients {
    const context = contexts(connection);
    if (context.config.mode !== 'attached') return context.control;
    return context.deployer(account.externalId, accountConfigOf(account.config));
  }

  return {
    ...pools,

    async launch(connection, input) {
      if (input.pod) return pods.launch(connection, input);
      const project = input.account.externalId;
      const machineType = input.machineType ? MACHINE_TYPES[input.machineType] : undefined;
      try {
        const build = await clientsFor(connection, input.account).cloudBuild.createBuild(
          project,
          input.region,
          {
            steps: [
              {
                name: input.image,
                env: [
                  `BEMMOLY_URL=${input.controlPlaneUrl}`,
                  `BEMMOLY_LAUNCH_TOKEN=$${LAUNCH_TOKEN_SUBSTITUTION}`,
                  `BEMMOLY_RUNNER_NAME=cloud-build-${input.labels.job.slice(0, 8)}`,
                  `BEMMOLY_RUNNER_DATA_DIR=${CLOUD_BUILD_DATA_DIR}`,
                  'BEMMOLY_RUNNER_VOLUMES_FROM=self',
                ],
              },
            ],
            substitutions: { [LAUNCH_TOKEN_SUBSTITUTION]: input.launchToken },
            ...(input.serviceAccount
              ? { serviceAccount: `projects/${project}/serviceAccounts/${input.serviceAccount}` }
              : {}),
            timeout: `${input.timeoutMinutes * 60}s`,
            tags: ['bemmoly', tag(`pool-${input.labels.pool}`), tag(`job-${input.labels.job}`)],
            ...(machineType ? { machineType } : {}),
          },
        );
        return { ref: build.id, logUrl: build.logUrl };
      } catch (error) {
        if (error instanceof GcpApiError && (error.status === 403 || error.status === 400)) {
          throw new ProviderError(
            `Cloud Build would not start a build in ${project}: ${error.message}. Check that the Cloud Build API is on there and that Pipelines may act as the build service account`,
          );
        }
        throw error;
      }
    },

    async status(connection, input) {
      if (parsePodRef(input.ref)) return pods.status(connection, input);
      const build = await clientsFor(connection, input.account).cloudBuild.findBuild(
        input.account.externalId,
        input.region,
        input.ref,
      );
      if (!build)
        return { state: 'gone', detail: 'Cloud Build has no build with this id any more' };
      const state = STATES[build.status] ?? 'working';
      const ended = state === 'failed' || state === 'cancelled';
      return {
        state,
        detail: ended
          ? (build.failureInfo?.detail ??
            ENDED_WHY[build.status] ??
            build.statusDetail ??
            'The build failed')
          : null,
      };
    },

    async cancel(connection, input) {
      if (parsePodRef(input.ref)) return pods.cancel(connection, input);
      try {
        await clientsFor(connection, input.account).cloudBuild.cancelBuild(
          input.account.externalId,
          input.region,
          input.ref,
        );
      } catch (error) {
        // A build that already ended, or is gone, has nothing left to cancel.
        if (error instanceof GcpApiError && [400, 404, 409].includes(error.status)) return;
        throw error;
      }
    },
  };
}
