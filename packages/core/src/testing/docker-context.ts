import { execFileSync } from 'node:child_process';

const DEFAULT_SOCKET = 'unix:///var/run/docker.sock';

function currentContextHost(): string | undefined {
  try {
    return execFileSync(
      'docker',
      ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'],
      {
        encoding: 'utf8',
        timeout: 5_000,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
  } catch {
    return undefined;
  }
}

/**
 * Testcontainers reads DOCKER_HOST but not the Docker CLI's current context,
 * which is how Colima and OrbStack expose their daemon. Adopt that context when
 * DOCKER_HOST is unset; containers inside the VM still see the default socket.
 */
export function adoptDockerCliContext(): void {
  if (process.env['DOCKER_HOST']) return;
  const host = currentContextHost();
  if (!host || host === DEFAULT_SOCKET) return;
  process.env['DOCKER_HOST'] = host;
  if (host.startsWith('unix://')) {
    process.env['TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE'] ??= '/var/run/docker.sock';
  }
}
