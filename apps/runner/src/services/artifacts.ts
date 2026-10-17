import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ResolvedStep } from '@bemmoly/module-pipelines/shared';
import type { OpenRawBody } from '../clients/http.ts';
import { expandGlobs } from '../utils/glob.ts';

export const MAX_ARTIFACT_BYTES = 100 * 1024 * 1024;

/** Artifact names are letters, digits, dots and dashes, starting with a letter or digit. */
export function artifactName(file: string, taken: Set<string>): string {
  const base = path.posix.basename(file).replace(/[^A-Za-z0-9._-]/g, '-');
  const clean = /^[A-Za-z0-9]/.test(base) ? base : `a${base}`;
  let name = clean.slice(0, 200);
  for (let n = 2; taken.has(name); n++) {
    const ext = path.posix.extname(clean);
    name = `${clean.slice(0, 190 - ext.length)}-${n}${ext}`;
  }
  taken.add(name);
  return name;
}

export type ArtifactUpload = (name: string, open: OpenRawBody) => Promise<void>;

/** Uploads every file the steps' artifact patterns match; one failure does not stop the rest. */
export async function uploadArtifacts(
  steps: readonly ResolvedStep[],
  workspace: string,
  upload: ArtifactUpload,
  line: (text: string) => void,
): Promise<void> {
  const patterns = steps.flatMap((step) => step.artifacts);
  if (patterns.length === 0) return;
  const files = await expandGlobs(patterns, workspace);
  if (files.length === 0) {
    line(`No artifacts matched ${patterns.join(', ')}`);
    return;
  }
  const taken = new Set<string>();
  for (const file of files) {
    const absolute = path.join(workspace, file);
    const { size } = await stat(absolute);
    if (size > MAX_ARTIFACT_BYTES) {
      line(`Skipped artifact ${file}: it is larger than 100 MB`);
      continue;
    }
    const name = artifactName(file, taken);
    try {
      await upload(name, () => ({
        body: Readable.toWeb(createReadStream(absolute)) as ReadableStream<Uint8Array>,
        length: size,
      }));
      line(`Kept artifact ${name} (${size} bytes)`);
    } catch (error) {
      line(`Could not keep artifact ${file}: ${(error as Error).message}`);
    }
  }
}
