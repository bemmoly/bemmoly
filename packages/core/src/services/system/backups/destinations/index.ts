import { createS3Bucket } from '../../../../clients/s3-bucket.ts';
import type { SystemDependencies } from '../../deps.ts';
import { readSetting } from '../../settings.ts';
import { createLocalDestination } from './local.ts';
import { createS3Destination } from './s3.ts';
import type { BackupDestination } from './types.ts';

export { createLocalDestination, isSetName } from './local.ts';
export { createS3Destination } from './s3.ts';
export type { BackupDestination } from './types.ts';

/** Local disk always; an S3-compatible bucket as the second copy when configured. */
export async function resolveDestinations(deps: SystemDependencies): Promise<BackupDestination[]> {
  if (deps.destinations) return deps.destinations();
  const destinations = [createLocalDestination(deps.config.backupDir)];
  const s3 = await readSetting(deps.settings, 'system.backups.s3');
  if (s3?.enabled) {
    const bucket = (deps.s3 ?? createS3Bucket)({
      region: s3.region,
      bucket: s3.bucket,
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
      forcePathStyle: s3.forcePathStyle,
      ...(s3.endpoint ? { endpoint: s3.endpoint } : {}),
    });
    destinations.push(createS3Destination(bucket, s3.prefix));
  }
  return destinations;
}
