import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

/*
 * The environment, parsed once. Flags win over these, and these win over the stored
 * sign-in, so CI can run bp with nothing but BEMMOLY_PIPELINES_URL and a token.
 */

const envSchema = z.object({
  BEMMOLY_PIPELINES_URL: z.url({ protocol: /^https?$/ }).optional(),
  /** A Bemmoly API token, or a CI token from Platform › Bring your CI. */
  BEMMOLY_PIPELINES_TOKEN: z.string().min(8).optional(),
  XDG_CONFIG_HOME: z.string().min(1).optional(),
  APPDATA: z.string().min(1).optional(),
  NO_COLOR: z.string().optional(),
  /** GitHub Actions' OIDC request, when bp runs inside a workflow with id-token: write. */
  ACTIONS_ID_TOKEN_REQUEST_URL: z.url().optional(),
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: z.string().min(1).optional(),
});

export type CliEnv = z.infer<typeof envSchema> & { configDir: string };

export function parseEnv(source: Readonly<Record<string, string | undefined>>): CliEnv {
  const env = envSchema.parse(source);
  const base =
    env.XDG_CONFIG_HOME ??
    (process.platform === 'win32' && env.APPDATA ? env.APPDATA : join(homedir(), '.config'));
  return { ...env, configDir: join(base, 'bemmoly-pipelines') };
}

export function readEnv(): CliEnv {
  return parseEnv(process.env);
}
