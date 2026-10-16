import {
  registerReleaseBodySchema,
  type RegisterReleaseBody,
} from '@bemmoly/module-pipelines/shared';
import { usageError } from '../cli/errors.ts';
import { mergeJunit, parseJunit } from './junit.ts';

/*
 * The body of POST /api/v1/pipelines/releases, built the same way by `bp release create`
 * and the bemmoly/release GitHub Action, and checked against the shared contract before it
 * is sent, so a mistake is reported by bp rather than as a 400 from the server.
 */

export interface ReleaseInput {
  application: string;
  commitSha: string;
  version?: string | undefined;
  ref?: string | undefined;
  imageRepository?: string | undefined;
  image?: string | undefined;
  /** "linux/amd64=sha256:…" pairs, or a record already split. */
  images?: Record<string, string> | undefined;
  /** JUnit XML documents, already read from disk. */
  junit?: readonly string[] | undefined;
  attestation?: string | undefined;
  externalUrl?: string | undefined;
  notes?: string | undefined;
}

export function buildReleaseBody(input: ReleaseInput): RegisterReleaseBody {
  const tests =
    input.junit && input.junit.length > 0 ? mergeJunit(input.junit.map(parseJunit)) : undefined;
  const body: RegisterReleaseBody = {
    application: input.application,
    version: input.version || input.commitSha.slice(0, 7),
    commitSha: input.commitSha.toLowerCase(),
    ...(input.ref ? { ref: input.ref } : {}),
    ...(input.imageRepository ? { imageRepository: input.imageRepository } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(input.images && Object.keys(input.images).length > 0 ? { images: input.images } : {}),
    ...(tests ? { tests } : {}),
    ...(input.attestation ? { attestation: input.attestation } : {}),
    ...(input.externalUrl ? { externalUrl: input.externalUrl } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  };
  const checked = registerReleaseBodySchema.safeParse(body);
  if (!checked.success) {
    const issue = checked.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    throw usageError(`${where}${issue?.message ?? 'The release is not valid'}`);
  }
  return body;
}

/** "linux/amd64=sha256:…" (repeated) into the per-platform record. */
export function platformDigests(pairs: readonly string[]): Record<string, string> {
  const images: Record<string, string> = {};
  for (const pair of pairs) {
    const at = pair.indexOf('=');
    if (at <= 0) throw usageError(`--images takes platform=sha256:…, got "${pair}"`);
    images[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return images;
}
