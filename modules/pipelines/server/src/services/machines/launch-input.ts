import { z } from 'zod';
import { podImagesOf } from '../../../../shared/autopilot.ts';
import { resolvedStepSchema } from '../../../../shared/pipeline-spec.ts';
import type { MachineLaunch } from '../providers/runners-contract.ts';
import { poolConfigOf, type MachinePoolRow } from './store.ts';

/*
 * What one machine for one job is started with. A Cloud Build pool's machine is its build
 * settings; a GKE Autopilot pool's is a pod that holds every image the job's steps run in,
 * so a job whose pod could not be scheduled is refused here with a sentence instead of
 * waiting for a pod that never comes.
 */

/** Time for a machine to start, on top of the job's own timeout. */
const START_MINUTES = 15;
/** The most images one pod holds, and the most it may ask for in all. */
const MAX_POD_IMAGES = 8;
const MAX_POD_CPU = 28;
const MAX_POD_MEMORY_GB = 80;

export interface ReservedJob {
  jobId: string;
  runId: string;
  timeoutMinutes: number;
  token: string;
  steps: unknown;
}

const stepsSchema = z.array(resolvedStepSchema);

/** Why a pool cannot start this hosting's machines at all, or null when it can. */
export function settingsMissing(pool: MachinePoolRow): string | null {
  const config = poolConfigOf(pool.config);
  if (pool.hosting === 'gke-autopilot') {
    return config.autopilot
      ? null
      : 'This pool has no GKE Autopilot settings; set its cluster, image, size and service account';
  }
  return config.cloudBuild
    ? null
    : 'This pool has no Cloud Build settings; set its region, image and service account';
}

export function launchInput(
  pool: MachinePoolRow,
  job: ReservedJob,
  publicUrl: string,
): MachineLaunch | { refused: string } | null {
  const config = poolConfigOf(pool.config);
  const base = {
    account: { externalId: pool.account_external_id ?? '', config: pool.account_config ?? {} },
    controlPlaneUrl: publicUrl,
    launchToken: job.token,
    timeoutMinutes: job.timeoutMinutes + START_MINUTES,
    labels: { pool: pool.key, job: job.jobId, run: job.runId },
  };
  const autopilot = config.autopilot;
  if (pool.hosting === 'gke-autopilot' && autopilot) {
    const parsed = stepsSchema.safeParse(job.steps);
    const { images, builds } = podImagesOf(parsed.success ? parsed.data : []);
    const containers = images.length + (builds ? 1 : 0);
    if (images.length > MAX_POD_IMAGES) {
      return {
        refused: `This job's steps use ${images.length} images and a runner pod holds at most ${MAX_POD_IMAGES}. Use fewer images, or run the job on a Cloud Build pool`,
      };
    }
    const cpu = containers * autopilot.cpu;
    const memory = containers * autopilot.memoryGb;
    if (cpu > MAX_POD_CPU || memory > MAX_POD_MEMORY_GB) {
      return {
        refused: `This job's pod would ask for ${cpu} vCPU and ${memory} GiB, since each of its ${containers} step images gets the pool's size, and a runner pod may ask for at most ${MAX_POD_CPU} vCPU and ${MAX_POD_MEMORY_GB} GiB. Use fewer images, or make the pool's size smaller`,
      };
    }
    return {
      ...base,
      region: autopilot.location,
      image: autopilot.image,
      machineType: null,
      serviceAccount: autopilot.serviceAccount,
      pod: {
        cluster: { location: autopilot.location, name: autopilot.cluster.name },
        namespace: autopilot.namespace,
        size: { cpu: autopilot.cpu, memoryGb: autopilot.memoryGb, spot: autopilot.spot },
        stepImages: images,
        builderImage: builds ? autopilot.builderImage : null,
      },
    };
  }
  const build = config.cloudBuild;
  if (!build) return null;
  return {
    ...base,
    region: build.region,
    image: build.image,
    machineType: build.machine === 'default' ? null : build.machine,
    serviceAccount: build.serviceAccount,
  };
}
