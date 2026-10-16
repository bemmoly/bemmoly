import { existsSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ValidationError } from '@bemmoly/shared';
import { z } from 'zod';

type EnvSource = Readonly<Record<string, string | undefined>>;

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info');

export const runnerConfigSchema = z.object({
  /** The Bemmoly address; the runner protocol lives under <url>/api/v1/runner. */
  url: z
    .url({
      protocol: /^https?$/,
      error:
        'pass --url (or BEMMOLY_URL) with your Bemmoly address, such as https://bemmoly.example.com',
    })
    .transform((value) => value.replace(/\/+$/, '')),
  /** Only needed until the first registration is saved. */
  poolToken: z.string().min(16).max(200).optional(),
  name: z.string().min(1).max(120),
  labels: z.array(z.string().min(1).max(60)).max(50),
  local: z.boolean(),
  workspace: z.string().min(1).optional(),
  dataDir: z.string().min(1),
  once: z.boolean(),
  dockerSocket: z.string().min(1),
  logLevel: logLevelSchema,
  /** The only parts of the runner's own environment a local step inherits. */
  hostEnv: z.record(z.string(), z.string()),
});

export type RunnerConfig = z.infer<typeof runnerConfigSchema>;

/** What `bemmoly-runner split` reads from a step's environment. */
export const splitConfigSchema = z.object({
  BEMMOLY_API_URL: z.url({ protocol: /^https?$/ }).transform((v) => v.replace(/\/+$/, '')),
  BEMMOLY_JOB_ID: z.uuid(),
  BEMMOLY_JOB_TOKEN: z.string().min(1),
});

export type SplitConfig = z.infer<typeof splitConfigSchema>;

const RUN_OPTIONS = {
  url: { type: 'string' },
  'pool-token': { type: 'string' },
  name: { type: 'string' },
  labels: { type: 'string' },
  local: { type: 'boolean' },
  workspace: { type: 'string' },
  'data-dir': { type: 'string' },
  once: { type: 'boolean' },
  'docker-socket': { type: 'string' },
  'log-level': { type: 'string' },
} as const;

/**
 * Colima and Docker Desktop put the socket somewhere other than /var/run, so the default
 * follows DOCKER_HOST first, then Colima's default profile.
 */
export function defaultDockerSocket(env: EnvSource, exists = existsSync): string {
  const host = env['DOCKER_HOST'];
  if (host?.startsWith('unix://')) return host.slice('unix://'.length);
  const colima = path.join(homedir(), '.colima', 'default', 'docker.sock');
  return exists(colima) ? colima : '/var/run/docker.sock';
}

function expandHome(value: string): string {
  return value === '~' || value.startsWith('~/') ? path.join(homedir(), value.slice(1)) : value;
}

function splitLabels(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
}

const HOST_ENV_KEYS = ['PATH', 'HOME', 'LANG'] as const;

function pickHostEnv(env: EnvSource): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const key of HOST_ENV_KEYS) {
    const value = env[key];
    if (value !== undefined) picked[key] = value;
  }
  return picked;
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`)
    .join('; ');
}

/** Flags win over env; the process stops before doing anything when a value is wrong. */
export function loadRunnerConfig(
  argv: readonly string[],
  env: EnvSource = process.env,
  exists = existsSync,
): RunnerConfig {
  let values;
  try {
    ({ values } = parseArgs({ args: [...argv], options: RUN_OPTIONS, strict: true }));
  } catch (error) {
    throw new ValidationError((error as Error).message, { cause: error });
  }
  const workspace = values.workspace ?? env['BEMMOLY_RUNNER_WORKSPACE'];
  const parsed = runnerConfigSchema.safeParse({
    url: values.url ?? env['BEMMOLY_URL'],
    poolToken: values['pool-token'] ?? env['BEMMOLY_POOL_TOKEN'],
    name: values.name ?? env['BEMMOLY_RUNNER_NAME'] ?? hostname(),
    labels: splitLabels(values.labels ?? env['BEMMOLY_RUNNER_LABELS']),
    local: values.local ?? env['BEMMOLY_RUNNER_LOCAL'] === 'true',
    workspace: workspace === undefined ? undefined : path.resolve(expandHome(workspace)),
    dataDir: path.resolve(
      expandHome(values['data-dir'] ?? env['BEMMOLY_RUNNER_DATA_DIR'] ?? '~/.bemmoly-runner'),
    ),
    once: values.once ?? env['BEMMOLY_RUNNER_ONCE'] === 'true',
    dockerSocket: expandHome(values['docker-socket'] ?? defaultDockerSocket(env, exists)),
    logLevel: values['log-level'] ?? env['LOG_LEVEL'],
    hostEnv: pickHostEnv(env),
  });
  if (!parsed.success) throw new ValidationError(describeIssues(parsed.error));
  if (parsed.data.workspace !== undefined && !parsed.data.local) {
    throw new ValidationError('--workspace works only with --local');
  }
  return parsed.data;
}

export function loadSplitConfig(env: EnvSource = process.env): SplitConfig {
  const parsed = splitConfigSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new ValidationError(
      `bemmoly-runner split runs inside a job step, which sets ${missing} for it`,
    );
  }
  return parsed.data;
}

export function loadLogLevel(env: EnvSource = process.env): z.infer<typeof logLevelSchema> {
  return logLevelSchema.catch('info').parse(env['LOG_LEVEL']);
}
