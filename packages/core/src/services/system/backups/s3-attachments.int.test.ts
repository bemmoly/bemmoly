import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buffer } from 'node:stream/consumers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createS3Bucket } from '../../../clients/s3-bucket.ts';
import { createTarTool } from '../../../clients/tar.ts';
import type { ObjectStore } from '../../../contracts/object-store.ts';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.ts';
import { startTestS3, type TestS3 } from '../../../testing/s3.ts';
import { applyKernelChangelog } from '../../../testing/kernel-changelog.ts';
import { createS3ObjectStore, putContent } from '../../storage/index.ts';
import type { SystemDependencies } from '../deps.ts';
import { importAttachments, stageAttachments } from './attachment-files.ts';
import { planAttachments, scanAttachments } from './attachments.ts';
import { createS3Destination } from './destinations/s3.ts';
import { restoreBackup } from './restore.ts';
import { runBackup } from './run-backup.ts';
import { createHarness, findPgTools } from './testing/harness.ts';

/*
 * Uploads kept in an S3 object store (MinIO here) are backed up and restored like uploads
 * on disk: listed from the bucket, archived into the backup, and put back into the bucket.
 */

const PASSPHRASE = 'integration-test-passphrase-0123';
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** Docs images, a workspace logo and a Work attachment, as their services store them. */
const UPLOADS = [
  { prefix: 'attachments/files', body: Buffer.from('a page image') },
  { prefix: 'attachments/files', body: Buffer.from('another page image') },
  { prefix: 'attachments/brand', body: Buffer.from('the workspace logo') },
];

async function upload(store: ObjectStore, spoolDir: string, body: Buffer, prefix: string) {
  return putContent(store, body, { contentType: 'image/png', prefix, spoolDir });
}

async function bytesOf(store: ObjectStore, key: string): Promise<Buffer> {
  return buffer((await store.get(key)).body);
}

describe('backups of uploads kept in S3', () => {
  let s3: TestS3 | undefined;
  let skip = '';
  let work = '';

  const storeIn = (bucket: string, prefix: string) => {
    if (!s3?.available) throw new Error('no S3');
    return createS3ObjectStore({
      endpoint: s3.endpoint,
      region: s3.region,
      bucket,
      forcePathStyle: true,
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
      prefix,
      timeoutMs: 30_000,
    });
  };

  beforeAll(async () => {
    s3 = await startTestS3();
    if (!s3.available) {
      skip = s3.reason;
      return;
    }
    await s3.createBucket('uploads');
    await s3.createBucket('backups');
    work = await mkdtemp(path.join(os.tmpdir(), 'bemmoly-s3-attachments-'));
  });

  afterAll(async () => {
    if (s3?.available) await s3.stop();
    if (work) await rm(work, { recursive: true, force: true });
  });

  it('archives every upload in the bucket and puts them back into an empty one', async (ctx) => {
    if (!s3?.available) return ctx.skip(skip);
    const uploads = storeIn('uploads', 'archive-source');
    const spool = path.join(work, 'spool');
    const stored = await Promise.all(
      UPLOADS.map((item) => upload(uploads, spool, item.body, item.prefix)),
    );
    // Not an upload: outside attachments/, so never part of a backup.
    await uploads.put({ key: 'imports/raw.json', body: Buffer.from('{}'), contentType: 'x' });

    const index = await scanAttachments(uploads);
    expect([...index.keys()].sort()).toEqual(
      stored.map((item) => item.key.slice('attachments/'.length)).sort(),
    );
    const plan = planAttachments({
      setName: 'set-1',
      current: index,
      previous: null,
      forceFull: false,
      now: new Date(),
    });
    expect(plan).toMatchObject({ mode: 'full', bytes: 12 + 18 + 18 });

    const staging = path.join(work, 'staging');
    await mkdir(staging, { recursive: true });
    const deps = {
      config: { dataDir: path.join(work, 'data') },
      tar: createTarTool(),
      objectStore: uploads,
    } as unknown as SystemDependencies;
    const archive = await stageAttachments(deps, staging, plan.files);
    expect(archive?.digest.sizeBytes).toBeGreaterThan(0);

    const extracted = path.join(work, 'extracted');
    await mkdir(extracted, { recursive: true });
    await createTarTool().extract(createReadStream(archive!.path), extracted);
    const restored = storeIn('uploads', 'archive-restored');
    expect(await importAttachments(restored, extracted)).toBe(3);
    for (const [i, item] of stored.entries()) {
      expect(sha(await bytesOf(restored, item.key))).toBe(sha(UPLOADS[i]!.body));
    }
    expect(await restored.head('imports/raw.json')).toBeNull();
    // Content addressed: importing again writes nothing new.
    expect(await importAttachments(restored, extracted)).toBe(0);
  });

  describe('a full backup and restore', () => {
    let database: TestDatabase | undefined;
    let pgSkip = '';

    beforeAll(async () => {
      if (!s3?.available) return;
      database = await startTestDatabase();
      if (!database.available) pgSkip = database.reason;
      const found = await findPgTools(process.env['BEMMOLY_TEST_PG_BIN_DIR']);
      if ('reason' in found) pgSkip = found.reason;
    });

    afterAll(async () => {
      if (database?.available) await database.stop();
    });

    it('restores the bucket’s uploads from the encrypted off-box copy', async (ctx) => {
      if (!s3?.available) return ctx.skip(skip);
      if (!database?.available || pgSkip) return ctx.skip(pgSkip);
      const found = await findPgTools(process.env['BEMMOLY_TEST_PG_BIN_DIR']);
      if ('reason' in found) return ctx.skip(found.reason);
      const uploads = storeIn('uploads', 'install');
      const remote = createS3Destination(
        createS3Bucket({
          endpoint: s3.endpoint,
          region: s3.region,
          bucket: 'backups',
          accessKeyId: s3.accessKeyId,
          secretAccessKey: s3.secretAccessKey,
          forcePathStyle: true,
        }),
        'bemmoly',
      );
      const harness = await createHarness({
        serverUrl: database.url,
        pgTools: found.tools,
        destinations: () => [remote],
        passphrase: PASSPHRASE,
        objectStore: uploads,
      });
      try {
        await applyKernelChangelog(harness.sql);
        const spool = path.join(harness.dataDir, 'tmp');
        const stored = await Promise.all(
          UPLOADS.map((item) => upload(uploads, spool, item.body, item.prefix)),
        );

        const backup = await runBackup(harness.deps, { kind: 'manual' });
        expect(backup.status).toBe('succeeded');
        expect(backup.manifest?.attachments).toMatchObject({ fileCount: 3, totalFileCount: 3 });
        expect(backup.manifest?.attachments.archive?.sizeBytes).toBeGreaterThan(0);

        // Lose every upload, then restore from the S3 destination alone.
        for (const item of stored) await uploads.delete(item.key);
        expect((await scanAttachments(uploads)).size).toBe(0);
        const remoteOnly = { ...harness.deps, destinations: async () => [remote] };
        const result = await restoreBackup(remoteOnly, backup.setName);
        expect(result.attachmentsRestored).toBe(3);
        for (const [i, item] of stored.entries()) {
          expect(sha(await bytesOf(uploads, item.key))).toBe(sha(UPLOADS[i]!.body));
        }
      } finally {
        await harness.sql.end({ timeout: 5 });
      }
    });
  });
});
