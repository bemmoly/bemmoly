import { randomBytes } from 'node:crypto';
import { ValidationError } from '@bemmoly/shared';
import { isLocalDockerHost } from '../../../../../shared/clouds.ts';
import { isImageReference, isImageRepository } from '../../../../../shared/image-reference.ts';
import { createDockerClient, publishedPort, type DockerClient } from '../../../clients/docker.ts';
import { createSplitterClient, type SplitterClient } from '../../../clients/splitter.ts';
import type { DeployTarget, ReleaseArtifact } from '../contract.ts';
import { DEMO_APP_PROGRAM, SPLITTER_PROGRAM } from './programs.ts';

/*
 * The local provider's containers: one traffic splitter per application and environment,
 * and one container per revision behind it, all on one Docker network and labelled so they
 * can be found again after a restart. Nothing here is remembered in memory: the routes
 * live in the splitter and the revisions are the containers, as weights live in the cloud
 * for every other provider (architecture §19).
 */

export const NETWORK = 'bemmoly-pipelines-local';
const LABEL = 'dev.bemmoly.pipelines';
const SPLITTER_ADMIN = 8081;
const SPLITTER_PUBLIC = 8080;
const APP_PORT = 8080;

export interface LocalConfig {
  dockerHost: string;
  nodeImage: string;
  syntheticRps: number;
}

export function localConfig(config: Readonly<Record<string, unknown>>): LocalConfig {
  const text = (key: string, fallback: string) =>
    typeof config[key] === 'string' && config[key] ? (config[key] as string) : fallback;
  const rps = Number(config['syntheticRps']);
  // Checked again here for connections stored before the API checked it.
  const dockerHost = text('dockerHost', 'unix:///var/run/docker.sock');
  if (!isLocalDockerHost(dockerHost)) {
    throw new ValidationError(
      'The local connection must use a Docker socket on this machine; connect it again',
    );
  }
  return {
    dockerHost,
    nodeImage: text('nodeImage', 'node:22.17.1-alpine'),
    syntheticRps: Number.isFinite(rps) && rps >= 0 ? rps : 5,
  };
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .slice(0, 40);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function splitterName(target: DeployTarget): string {
  return `bp-${target.environment.key}-${target.application.key}-splitter`;
}

export function revisionContainer(target: DeployTarget, revision: string): string {
  return `bp-${target.environment.key}-${revision}`;
}

export function upstreamOf(target: DeployTarget, revision: string): string {
  return `http://${revisionContainer(target, revision)}:${APP_PORT}`;
}

function labelsFor(target: DeployTarget, role: 'splitter' | 'revision', revision?: string) {
  return {
    [LABEL]: 'true',
    [`${LABEL}.role`]: role,
    [`${LABEL}.environment`]: target.environment.key,
    [`${LABEL}.application`]: target.application.key,
    ...(revision ? { [`${LABEL}.revision`]: revision } : {}),
  };
}

const configNumber = (
  release: ReleaseArtifact,
  environment: string,
  name: string,
  fallback: number,
) => {
  const value = release.resolvedConfig[`${name}@${environment}`] ?? release.resolvedConfig[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

/** The repository a release's image lives in, or null for the demo program. */
export function releaseRepository(release: ReleaseArtifact): string | null {
  const digest = Object.values(release.imageDigests)[0];
  if (!release.imageRepository || !digest) return null;
  if (!isImageRepository(release.imageRepository)) {
    throw new ValidationError(`${release.imageRepository} is not an image repository`);
  }
  return release.imageRepository;
}

export function createLocalRuntime(config: LocalConfig) {
  const docker: DockerClient = createDockerClient({ host: config.dockerHost });

  async function ensureImage(image: string): Promise<void> {
    if (!isImageReference(image)) throw new ValidationError(`${image} is not an image name`);
    if (!(await docker.hasImage(image))) await docker.pull(image);
  }

  async function running(name: string) {
    const found = await docker.inspect(name);
    if (found && !found.State.Running) await docker.start(name);
    return found ? await docker.inspect(name) : null;
  }

  /** The application's splitter in this environment, created on first use. */
  async function splitter(target: DeployTarget): Promise<{ client: SplitterClient; url: string }> {
    const found = await existingOrCreated(target, true);
    if (!found) throw new Error(`${splitterName(target)} could not be created`);
    return found;
  }

  /** The splitter when it exists; reads (metrics, health) never create one. */
  async function existing(target: DeployTarget) {
    return existingOrCreated(target, false);
  }

  async function existingOrCreated(
    target: DeployTarget,
    create: boolean,
  ): Promise<{ client: SplitterClient; url: string } | null> {
    const name = splitterName(target);
    let found = await running(name);
    if (!found && !create) return null;
    if (!found) {
      await ensureImage(config.nodeImage);
      await docker.ensureNetwork(NETWORK, { [LABEL]: 'true' });
      await docker.create({
        name,
        image: config.nodeImage,
        cmd: ['node', '-e', SPLITTER_PROGRAM],
        env: { LOAD_RPS: String(config.syntheticRps) },
        labels: labelsFor(target, 'splitter'),
        network: NETWORK,
        publish: [SPLITTER_PUBLIC, SPLITTER_ADMIN],
      });
      await docker.start(name);
      found = await docker.inspect(name);
    }
    const admin = found ? publishedPort(found, SPLITTER_ADMIN) : null;
    const pub = found ? publishedPort(found, SPLITTER_PUBLIC) : null;
    if (!admin || !pub) throw new Error(`${name} has no published ports`);
    const client = createSplitterClient(`http://127.0.0.1:${admin}`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        await client.routes();
        return { client, url: `http://127.0.0.1:${pub}` };
      } catch {
        await sleep(250);
      }
    }
    throw new Error(`${name} did not start answering`);
  }

  /**
   * The release's own image, when it has one. Builds on our runners leave a local image
   * (bemmoly-local/<app>:<commit>) whose id is the release's digest; other releases name a
   * registry image by digest, pulled when this machine does not have it yet.
   */
  async function releaseImage(release: ReleaseArtifact): Promise<string | null> {
    const repository = releaseRepository(release);
    const digest = Object.values(release.imageDigests)[0];
    if (!repository || !digest) return null;
    const tagged = `${repository}:${release.commitSha.replace(/[^A-Za-z0-9_.-]/g, '-')}`;
    for (const candidate of [digest, `${repository}@${digest}`, tagged]) {
      if (await docker.hasImage(candidate)) return candidate;
    }
    const remote = `${repository}@${digest}`;
    await docker.pull(remote);
    return remote;
  }

  async function startRevision(target: DeployTarget, release: ReleaseArtifact): Promise<string> {
    const revision = `${target.application.key}-${slug(release.version)}-${randomBytes(2).toString('hex')}`;
    const name = revisionContainer(target, revision);
    const real = await releaseImage(release);
    const image = real ?? config.nodeImage;
    if (!real) await ensureImage(image);
    const env = target.environment.key;
    await docker.create({
      name,
      image,
      ...(real ? {} : { cmd: ['node', '-e', DEMO_APP_PROGRAM] }),
      env: {
        PORT: String(APP_PORT),
        VERSION: release.version,
        REVISION: revision,
        APPLICATION: target.application.key,
        ERROR_RATE: String(configNumber(release, env, 'demo.errorRate', 0)),
        LATENCY_MS: String(configNumber(release, env, 'demo.latencyMs', 40)),
      },
      labels: labelsFor(target, 'revision', revision),
      network: NETWORK,
    });
    await docker.start(name);
    return revision;
  }

  /** Revision containers of this application here, newest first. */
  async function revisions(target: DeployTarget) {
    const found = await docker.list({
      [`${LABEL}.role`]: 'revision',
      [`${LABEL}.environment`]: target.environment.key,
      [`${LABEL}.application`]: target.application.key,
    });
    return found
      .map((c) => ({
        revision: c.Labels[`${LABEL}.revision`] ?? '',
        name: c.Names[0]?.slice(1) ?? '',
        created: c.Created,
      }))
      .sort((a, b) => b.created - a.created);
  }

  return { docker, splitter, existing, startRevision, revisions, running };
}

export type LocalRuntime = ReturnType<typeof createLocalRuntime>;
