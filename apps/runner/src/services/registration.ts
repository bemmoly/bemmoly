import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HEARTBEAT_SECONDS } from '@bemmoly/module-pipelines/shared';
import { ValidationError } from '@bemmoly/shared';
import { z } from 'zod';
import type { ControlPlaneClient } from '../clients/control-plane.ts';
import type { Logger } from '../config/logger.ts';

const FILE = 'registration.json';

const registrationSchema = z.object({
  runnerId: z.string().min(1),
  runnerToken: z.string().min(1),
  url: z.string().min(1),
  heartbeatSeconds: z.number().int().min(1).default(HEARTBEAT_SECONDS),
});

export type Registration = z.infer<typeof registrationSchema>;

export interface RegistrationDeps {
  client: ControlPlaneClient;
  logger: Logger;
  dataDir: string;
  url: string;
  poolToken: string | undefined;
  name: string;
  version: string;
  labels: string[];
}

/** The saved registration for this control plane, or null when there is none to reuse. */
export async function loadRegistration(dataDir: string, url: string): Promise<Registration | null> {
  const raw = await readFile(path.join(dataDir, FILE), 'utf8').catch(() => undefined);
  if (raw === undefined) return null;
  try {
    const saved = registrationSchema.parse(JSON.parse(raw));
    // A runner pointed at another install registers there afresh.
    return saved.url === url ? saved : null;
  } catch {
    return null;
  }
}

export async function forgetRegistration(dataDir: string): Promise<void> {
  await rm(path.join(dataDir, FILE), { force: true });
}

/** Registers with the pool token and saves the runner token, readable by this user only. */
export async function register(deps: RegistrationDeps): Promise<Registration> {
  if (!deps.poolToken) {
    throw new ValidationError(
      'This runner is not registered yet: pass --pool-token (or BEMMOLY_POOL_TOKEN) from the pool settings',
    );
  }
  const answer = await deps.client.register({
    poolToken: deps.poolToken,
    name: deps.name,
    version: deps.version,
    labels: deps.labels,
  });
  const registration: Registration = {
    runnerId: answer.runnerId,
    runnerToken: answer.runnerToken,
    url: deps.url,
    heartbeatSeconds: answer.heartbeatSeconds,
  };
  await mkdir(deps.dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(deps.dataDir, FILE);
  await writeFile(file, JSON.stringify(registration, null, 2), { mode: 0o600 });
  // writeFile keeps an existing file's mode; a file from an older run is tightened too.
  await chmod(file, 0o600);
  deps.logger.info(
    { runnerId: answer.runnerId, pool: answer.pool.key },
    'registered with the control plane',
  );
  return registration;
}

/** The saved registration if there is one, else a new one. */
export async function ensureRegistration(deps: RegistrationDeps): Promise<Registration> {
  return (await loadRegistration(deps.dataDir, deps.url)) ?? register(deps);
}
