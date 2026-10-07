import { releaseSchema, updaterStatusSchema, type UpdaterStatus } from '@bemmoly/shared';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

/** Written by the updater (in-app or one-shot from the CLI) into the shared data folder. */
export const UPDATER_STATE_FILE = path.join('updater', 'state.json');
const CHECK_STATE_FILE = path.join('system', 'update-check.json');

export const updateCheckStateSchema = z.object({
  checkedAt: z.iso.datetime(),
  manifest: z.enum(['verified', 'unverified']).nullable(),
  error: z.string().nullable(),
  available: releaseSchema.nullable(),
  /** The version update.available was last published for, so it is announced once. */
  announced: z.string().nullable(),
});

export type UpdateCheckState = z.infer<typeof updateCheckStateSchema>;

async function readJson<T>(file: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    return schema.parse(JSON.parse(await readFile(file, 'utf8')));
  } catch {
    return null;
  }
}

export function readUpdateCheckState(dataDir: string): Promise<UpdateCheckState | null> {
  return readJson(path.join(dataDir, CHECK_STATE_FILE), updateCheckStateSchema);
}

export async function writeUpdateCheckState(
  dataDir: string,
  state: UpdateCheckState,
): Promise<void> {
  const file = path.join(dataDir, CHECK_STATE_FILE);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(state, null, 2));
  await rename(`${file}.tmp`, file);
}

export function readUpdaterState(dataDir: string): Promise<UpdaterStatus | null> {
  return readJson(path.join(dataDir, UPDATER_STATE_FILE), updaterStatusSchema);
}
