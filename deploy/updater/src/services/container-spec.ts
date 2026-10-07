import type Docker from 'dockerode';
import type { ContainerInfo, ImageInfo } from '../clients/docker.ts';

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Create options for a copy of `container` running `image`. Values the old image
 * supplied (its ENV, labels, command, healthcheck) are dropped so the new image's own
 * apply; everything Compose set (env file, mounts, network aliases, restart policy,
 * labels) is kept, so the new container takes the old one's place on the network.
 */
export function cloneSpec(
  container: ContainerInfo,
  oldImage: ImageInfo | null,
  image: string,
): Docker.ContainerCreateOptions {
  const config = container.Config;
  const fromImage = oldImage?.Config;
  const imageEnv = new Set(fromImage?.Env ?? []);
  const imageLabels = fromImage?.Labels ?? {};
  const labels = Object.fromEntries(
    Object.entries(config.Labels ?? {}).filter(([key, value]) => imageLabels[key] !== value),
  );
  const endpoints: Record<string, Docker.EndpointSettings> = {};
  for (const [name, network] of Object.entries(container.NetworkSettings.Networks ?? {})) {
    endpoints[name] = {
      Aliases: (network.Aliases ?? []).filter((alias: string) => !container.Id.startsWith(alias)),
      ...(network.IPAMConfig ? { IPAMConfig: network.IPAMConfig } : {}),
    };
  }
  const spec: Docker.ContainerCreateOptions = {
    Image: image,
    Env: (config.Env ?? []).filter((entry) => !imageEnv.has(entry)),
    Labels: labels,
    HostConfig: container.HostConfig,
    NetworkingConfig: { EndpointsConfig: endpoints },
  };
  if (config.Hostname && !container.Id.startsWith(config.Hostname)) spec.Hostname = config.Hostname;
  if (!same(config.Cmd, fromImage?.Cmd)) spec.Cmd = config.Cmd;
  if (!same(config.Entrypoint, fromImage?.Entrypoint)) spec.Entrypoint = config.Entrypoint;
  if (!same(config.User, fromImage?.User)) spec.User = config.User;
  if (!same(config.WorkingDir, fromImage?.WorkingDir)) spec.WorkingDir = config.WorkingDir;
  if (config.Healthcheck && !same(config.Healthcheck, fromImage?.Healthcheck)) {
    spec.Healthcheck = config.Healthcheck;
  }
  if (config.ExposedPorts) spec.ExposedPorts = config.ExposedPorts;
  return spec;
}

/**
 * A one-off task container from `image` with the app's env, mounts and network, used
 * to run bemmoly-system or bemmoly-db against an image other than the running one.
 */
export function taskSpec(
  container: ContainerInfo,
  oldImage: ImageInfo | null,
  image: string,
  cmd: string[],
): Docker.ContainerCreateOptions {
  const base = cloneSpec(container, oldImage, image);
  return {
    Image: image,
    Cmd: cmd,
    Env: base.Env ?? [],
    Labels: { 'com.bemmoly.updater.task': 'true' },
    HostConfig: {
      Binds: container.HostConfig.Binds ?? [],
      Mounts: container.HostConfig.Mounts ?? [],
      NetworkMode: container.HostConfig.NetworkMode ?? 'bridge',
      AutoRemove: false,
    },
  };
}

/** The version a container runs: its image tag, or the OCI version label. */
export function versionOf(container: ContainerInfo, image: ImageInfo | null): string | null {
  const tag = /:([^:/@]+)$/.exec(container.Config.Image)?.[1];
  if (tag && tag !== 'latest') return tag;
  return image?.Config.Labels?.['org.opencontainers.image.version'] ?? null;
}
