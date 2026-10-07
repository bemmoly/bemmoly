import Docker from 'dockerode';
import { PassThrough } from 'node:stream';

export type ContainerInfo = Docker.ContainerInspectInfo;
export type ImageInfo = Docker.ImageInspectInfo;

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const collect = (stream: PassThrough) => {
  let text = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => {
    text += chunk;
  });
  return () => text;
};

/**
 * Starts a container. Docker answers 304 when it is already running (a restart policy or
 * a host command can get there first), which is the outcome the caller wanted.
 */
export async function startContainer(container: Pick<Docker.Container, 'start'>): Promise<void> {
  try {
    await container.start();
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 304) throw error;
  }
}

/**
 * The service's live container among those carrying its Compose labels. A swap keeps the
 * replaced container as <name>-previous with the same labels (Docker cannot change them),
 * so it is never the one to act on.
 */
export function liveContainer(list: Docker.ContainerInfo[]): Docker.ContainerInfo | undefined {
  const live = list.filter((item) => !item.Names.some((name) => name.endsWith('-previous')));
  return live.find((item) => item.State === 'running') ?? live[0];
}

/** The few Docker Engine calls the updater makes, over the mounted socket. */
export function createDockerClient(socketPath = '/var/run/docker.sock') {
  const docker = new Docker({ socketPath, timeout: 60_000 });
  return {
    raw: docker,
    async findService(project: string, service: string): Promise<ContainerInfo | null> {
      const list = await docker.listContainers({
        all: true,
        filters: {
          label: [`com.docker.compose.project=${project}`, `com.docker.compose.service=${service}`],
        },
      });
      const live = liveContainer(list);
      return live ? docker.getContainer(live.Id).inspect() : null;
    },
    inspect: (id: string) => docker.getContainer(id).inspect(),
    async imageInfo(reference: string): Promise<ImageInfo | null> {
      try {
        return await docker.getImage(reference).inspect();
      } catch {
        return null;
      }
    },
    async pull(reference: string): Promise<void> {
      const stream = await docker.pull(reference);
      await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(stream, (error: Error | null) =>
          error ? reject(error) : resolve(),
        );
      });
    },
    async listImages(repository: string): Promise<Docker.ImageInfo[]> {
      return docker.listImages({ filters: { reference: [repository] } });
    },
    async removeImage(reference: string): Promise<void> {
      await docker.getImage(reference).remove();
    },
    /** Runs a command in a running container and collects its output. */
    async exec(id: string, cmd: string[], timeoutMs = 30 * 60_000): Promise<ExecResult> {
      const exec = await docker
        .getContainer(id)
        .exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true });
      const stream = await exec.start({ hijack: true, stdin: false });
      const out = new PassThrough();
      const err = new PassThrough();
      const stdout = collect(out);
      const stderr = collect(err);
      docker.modem.demuxStream(stream, out, err);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${cmd.join(' ')} timed out`)), timeoutMs);
        stream.on('end', () => {
          clearTimeout(timer);
          resolve();
        });
        stream.on('error', reject);
      });
      const { ExitCode } = await exec.inspect();
      return { exitCode: ExitCode ?? 1, stdout: stdout(), stderr: stderr() };
    },
    /** A one-off container from `image` with the given config; removed when it exits. */
    async runTask(
      options: Docker.ContainerCreateOptions,
      timeoutMs = 6 * 3_600_000,
    ): Promise<ExecResult> {
      const container = await docker.createContainer({
        ...options,
        Tty: false,
        AttachStdout: true,
        AttachStderr: true,
      });
      const out = new PassThrough();
      const err = new PassThrough();
      const stdout = collect(out);
      const stderr = collect(err);
      const stream = await container.attach({ stream: true, stdout: true, stderr: true });
      docker.modem.demuxStream(stream, out, err);
      try {
        await startContainer(container);
        const waited = (await Promise.race([
          container.wait(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('task timed out')), timeoutMs),
          ),
        ])) as { StatusCode: number };
        return { exitCode: waited.StatusCode, stdout: stdout(), stderr: stderr() };
      } finally {
        await container.remove({ force: true }).catch(() => undefined);
      }
    },
  };
}

export type DockerClient = ReturnType<typeof createDockerClient>;
