import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { CliError } from '../cli/errors.ts';

/*
 * The sign-in bp keeps between runs: the server and a token, in the person's config
 * directory, readable by them alone (0600 in a 0700 folder). Nothing else is stored.
 */

export const credentialsSchema = z.object({
  server: z.url(),
  token: z.string().min(8),
  /** Who the token belongs to, for whoami without a round trip. */
  name: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  /** How it was obtained: device sign-in or a pasted token. */
  source: z.enum(['device', 'token']),
  /** When an access token from device sign-in expires, ISO; null for API tokens. */
  expiresAt: z.string().nullable().default(null),
});

export type Credentials = z.infer<typeof credentialsSchema>;

const FILE = 'credentials.json';

export async function loadCredentials(configDir: string): Promise<Credentials | null> {
  let text: string;
  try {
    text = await readFile(join(configDir, FILE), 'utf8');
  } catch {
    return null;
  }
  try {
    return credentialsSchema.parse(JSON.parse(text));
  } catch {
    throw new CliError(
      `${join(configDir, FILE)} cannot be read. Run "bp logout" and sign in again.`,
    );
  }
}

export async function saveCredentials(
  configDir: string,
  credentials: Credentials,
): Promise<string> {
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  await chmod(configDir, 0o700);
  const path = join(configDir, FILE);
  await writeFile(path, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
  // A file that already existed keeps its old mode through writeFile; set it either way.
  await chmod(path, 0o600);
  return path;
}

export async function removeCredentials(configDir: string): Promise<boolean> {
  const path = join(configDir, FILE);
  const existed = (await loadCredentials(configDir).catch(() => null)) !== null;
  await rm(path, { force: true });
  return existed;
}
