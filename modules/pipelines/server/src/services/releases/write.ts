import type { SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError } from '@bemmoly/shared';
import type { ReleaseSource, ReleaseTestSummary } from '../../../../shared/releases.ts';

/*
 * The one way a release comes to exist (architecture §11): from a build on our own runners
 * when it passes, or from Bring your CI registering one built elsewhere. A release never
 * changes afterwards, so asking again with the same version and images returns the one that
 * exists, and the same version with different images is refused: that would be a different
 * thing wearing the same name.
 */

export interface CreateReleaseInput {
  applicationId: string;
  version: string;
  /** The contract's words: built by our runners, or registered from someone else's CI. */
  source: ReleaseSource;
  commitSha: string;
  ref?: string | null;
  imageRepository?: string | null;
  /** Platform → digest. */
  imageDigests: Readonly<Record<string, string>>;
  testSummary?: (ReleaseTestSummary & { failures?: unknown[] }) | null;
  provenance?: Record<string, unknown> | null;
  notes?: string | null;
  createdBy?: string | null;
  externalUrl?: string | null;
  /** The run that built it, for releases from our runners. */
  runId?: string | null;
  /** Resolved configuration, when the build knows it. */
  resolvedConfig?: Record<string, unknown>;
}

export interface CreatedRelease {
  id: string;
  applicationId: string;
  version: string;
  commitSha: string;
  imageDigests: Record<string, string>;
  createdAt: string;
}

export interface ReleaseWriter {
  createRelease(
    tx: SqlExecutor,
    input: CreateReleaseInput,
  ): Promise<{ release: CreatedRelease; created: boolean }>;
}

const sameDigests = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>) => {
  const keys = Object.keys(a).sort();
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

interface Row {
  id: string;
  application_id: string;
  version: string;
  commit_sha: string;
  image_digests: Record<string, string>;
  created_at: string;
}

const toCreated = (row: Row): CreatedRelease => ({
  id: row.id,
  applicationId: row.application_id,
  version: row.version,
  commitSha: row.commit_sha,
  imageDigests: row.image_digests,
  createdAt: new Date(row.created_at).toISOString(),
});

export function createReleaseWriter(): ReleaseWriter {
  return {
    async createRelease(tx, input) {
      const [application] = await tx<{ id: string }[]>`
        select id from pipeline_applications where id = ${input.applicationId}`;
      if (!application) throw new NotFoundError('That application does not exist');
      const provenance =
        input.provenance || input.externalUrl
          ? {
              ...input.provenance,
              ...(input.externalUrl ? { externalUrl: input.externalUrl } : {}),
            }
          : null;
      const [inserted] = await tx<Row[]>`
        insert into pipeline_releases
          (application_id, version, source, run_id, commit_sha, ref, image_repository,
           image_digests, resolved_config, test_summary, provenance, notes, created_by)
        values (${input.applicationId}, ${input.version},
          ${input.source}, ${input.runId ?? null},
          ${input.commitSha}, ${input.ref ?? null}, ${input.imageRepository ?? null},
          ${JSON.stringify(input.imageDigests)}::jsonb,
          ${JSON.stringify(input.resolvedConfig ?? {})}::jsonb,
          ${input.testSummary ? JSON.stringify(input.testSummary) : null}::jsonb,
          ${provenance ? JSON.stringify(provenance) : null}::jsonb, ${input.notes ?? null},
          ${input.createdBy ?? null})
        on conflict (application_id, version) do nothing
        returning id, application_id, version, commit_sha, image_digests, created_at`;
      if (inserted) return { release: toCreated(inserted), created: true };
      const [existing] = await tx<Row[]>`
        select id, application_id, version, commit_sha, image_digests, created_at
        from pipeline_releases
        where application_id = ${input.applicationId} and version = ${input.version}`;
      if (!existing) throw new ConflictError('The release changed while it was being recorded');
      if (!sameDigests(existing.image_digests, input.imageDigests)) {
        throw new ConflictError(
          `${input.version} already exists with different images. Releases never change; give this build a new version.`,
        );
      }
      return { release: toCreated(existing), created: false };
    },
  };
}
