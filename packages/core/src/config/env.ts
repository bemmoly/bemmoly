import { moduleIdSchema } from '@bemmoly/shared';
import { z } from 'zod';

const SECRET_KEY_BYTES = 32;

const base64Key = z
  .string()
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'must be base64')
  .refine((value) => Buffer.from(value, 'base64').length === SECRET_KEY_BYTES, {
    message: `must decode to ${SECRET_KEY_BYTES} bytes (generate with: openssl rand -base64 32)`,
  });

const moduleList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
  .pipe(z.array(moduleIdSchema));

/** Changelog contexts this install runs: production, demo, test (comma separated). */
const contextList = z
  .string()
  .default('production')
  .transform((value) =>
    value
      .split(',')
      .map((context) => context.trim())
      .filter((context) => context.length > 0),
  )
  .pipe(z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).min(1));

/** A rate limit can be raised or lowered, never switched off. */
const rateLimitMax = z.coerce.number().int().min(1).max(1_000_000).optional();

export const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  BEMMOLY_SECRET_KEY: base64Key,
  BEMMOLY_PUBLIC_URL: z.url({ protocol: /^https?$/ }),
  BEMMOLY_ROLE: z.enum(['all', 'api', 'worker']).default('all'),
  BEMMOLY_MODULES: moduleList,
  BEMMOLY_DATA_DIR: z.string().min(1).default('/var/bemmoly/data'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  BEMMOLY_TRUST_PROXY: z.stringbool().default(false),
  /** Rate limit maxima; unset keeps the defaults in middlewares/rate-limit.ts. */
  BEMMOLY_RATE_LIMIT_PER_USER: rateLimitMax,
  BEMMOLY_RATE_LIMIT_AUTH_PER_IP: rateLimitMax,
  BEMMOLY_RATE_LIMIT_AUTH_PER_ACCOUNT: rateLimitMax,
  BEMMOLY_ALLOW_PRIVATE_URLS: z.stringbool().default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  BEMMOLY_METRICS_TOKEN: z
    .string()
    .min(32, 'must be at least 32 characters (generate with: openssl rand -hex 32)')
    .optional(),
  BEMMOLY_BACKUP_PASSPHRASE: z.string().min(16).optional(),
  BEMMOLY_DB_AUTO_MIGRATE: z.stringbool().default(true),
  BEMMOLY_DB_CONTEXTS: contextList,
  BEMMOLY_BACKUP_DIR: z.string().min(1).default('/var/bemmoly/backups'),
  /** The release this image is; unset or empty means the server package's own version. */
  BEMMOLY_VERSION: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  BEMMOLY_UPDATER_URL: z.url({ protocol: /^https?$/ }).optional(),
  UPDATER_TOKEN: z.string().min(32).optional(),
  BEMMOLY_PG_BIN_DIR: z.string().min(1).default('/usr/lib/postgresql/18/bin'),
});

export type Env = z.output<typeof envSchema>;

export class EnvError extends Error {
  override readonly name = 'EnvError';
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid environment:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.problems = problems;
  }
}

type EnvSource = Readonly<Record<string, string | undefined>>;

/** Empty values (`KEY=` in .env files) count as unset so defaults apply. */
function withoutEmptyValues(source: EnvSource): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

/** Parses and validates the environment. Messages name keys, never values. */
export function parseEnv(source: EnvSource): Env {
  const result = envSchema.safeParse(withoutEmptyValues(source));
  if (result.success) return result.data;
  throw new EnvError(
    result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  );
}

/** What `bemmoly-db` needs: enough to reach the database, nothing secret. */
export const databaseEnvSchema = envSchema
  .pick({ BEMMOLY_MODULES: true, BEMMOLY_DB_CONTEXTS: true, BEMMOLY_VERSION: true })
  .extend({ DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }) });

export type DatabaseEnv = z.output<typeof databaseEnvSchema>;

function parseWith<S extends z.ZodType>(schema: S, source: EnvSource): z.output<S> {
  const result = schema.safeParse(withoutEmptyValues(source));
  if (result.success) return result.data;
  throw new EnvError(
    result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  );
}

export function parseDatabaseEnv(source: EnvSource): DatabaseEnv {
  return parseWith(databaseEnvSchema, source);
}

/** The environment for database commands. Exits on a bad key. */
export function loadDatabaseEnv(): DatabaseEnv {
  try {
    return parseDatabaseEnv(process.env);
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

/** The only place the process environment is read. Exits on a bad key. */
export function loadEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    process.stderr.write(`${error.message}\nSee apps/server/.env.example for every key.\n`);
    process.exit(1);
  }
}
