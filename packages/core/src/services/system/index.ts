export { checkReadiness, type DatabaseProbe, type ReadinessDependencies } from './readiness.ts';
export { SYSTEM_CAPABILITY } from './authorize.ts';
export type {
  AuditActivity,
  ChangelogProbe,
  ChangesetTraits,
  EmailConfigurationProbe,
  JobEnqueuer,
  SystemConfig,
  SystemDependencies,
} from './deps.ts';
export {
  SYSTEM_EVENTS,
  type BackupFailedPayload,
  type BackupVerificationFailedPayload,
  type UpdateAvailablePayload,
} from './events.ts';
export { SYSTEM_JOBS, systemJobs } from './jobs.ts';
export { DEFAULT_MANIFEST_URLS, manifestUrlFor, SYSTEM_SETTINGS } from './settings.ts';

export {
  getBackup,
  listBackups,
  openBackupDownload,
  requestRestore,
  requestVerify,
  startManualBackup,
} from './backups/admin.ts';
export { ATTACHMENTS_SUBDIR, attachmentsDir } from './backups/attachments.ts';
export {
  createLocalDestination,
  createS3Destination,
  isSetName,
  type BackupDestination,
} from './backups/destinations/index.ts';
export {
  createDecryptStream,
  createEncryptStream,
  ENCRYPTION_ALGORITHM,
} from './backups/encryption.ts';
export { syncBackupIndex } from './backups/index-sync.ts';
export { handleBackupJob } from './backups/jobs.ts';
export { createModuleDataBackup, ModuleBackupError } from './backups/module-backup.ts';
export { backupManifestSchema, buildManifest, type BackupManifest } from './backups/manifest.ts';
export { pruneBackups } from './backups/prune.ts';
export { createBackupRepository, toBackupDto, type BackupRecord } from './backups/repository.ts';
export {
  mountBackup,
  restoreBackup,
  unmountBackup,
  type MountResult,
  type RestoreResult,
} from './backups/restore.ts';
export {
  selectRetained,
  type RetentionCandidate,
  type RetentionDecision,
} from './backups/retention.ts';
export { BackupRefusedError, runBackup, type RunBackupRequest } from './backups/run-backup.ts';
export { dueSlot, latestSlot } from './backups/schedule.ts';
export { runScheduledDrill, verifyBackup, type VerifyResult } from './backups/verify.ts';

export { getSystemHealth } from './health/system-health.ts';
export type { HttpsSignal } from './health/checks.ts';

export {
  createMaintenanceReader,
  enterMaintenance,
  exitMaintenance,
  readMaintenance,
  renderMaintenancePage,
  type MaintenanceState,
} from './maintenance/index.ts';

export { applyUpdate, getUpdatesOverview, requestRollback } from './updates/admin.ts';
export { createSqlAuditActivity } from './updates/audit-activity.ts';
export { storeCatalogUpload, MAX_BUNDLE_BYTES } from './updates/catalog.ts';
export { checkForUpdates } from './updates/check.ts';
export { computeRollbackPlan } from './updates/rollback-plan.ts';
export {
  decideRollbackMode,
  describeRollback,
  withinCompatibilityWindow,
} from './updates/rollback-mode.ts';
export { selectAvailable } from './updates/select.ts';

export { SYSTEM_CHANGESETS } from './changelog.ts';
export { applySystemChangesets } from './schema-fallback.ts';
export { createStderrLogger } from './utils/stderr-logger.ts';
export { diskSpace, formatBytes } from './utils/disk.ts';
