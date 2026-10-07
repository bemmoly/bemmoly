import type { Backup, SystemHealthResponse } from '@bemmoly/shared';

const MARK = { ok: '✓', warn: '!', fail: '✗' } as const;

function size(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function backupLine(backup: Backup): string {
  const where = backup.locations.map((location) => location.destination).join('+') || '-';
  return [
    backup.createdAt.slice(0, 16).replace('T', ' '),
    backup.kind.padEnd(11),
    backup.status.padEnd(9),
    size(backup.sizeBytes).padStart(8),
    backup.verification.state.padEnd(8),
    where.padEnd(8),
    backup.appVersion,
  ].join('  ');
}

function isBackup(value: unknown): value is Backup {
  return Boolean(value && typeof value === 'object' && 'kind' in value && 'locations' in value);
}

function isHealth(value: unknown): value is SystemHealthResponse {
  return Boolean(
    value && typeof value === 'object' && 'checks' in value && 'uptimeSeconds' in value,
  );
}

function plain(value: unknown, indent = ''): string {
  if (value === null || value === undefined) return `${indent}-`;
  if (typeof value !== 'object') return `${indent}${String(value)}`;
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? `${indent}${key}:\n${plain(item, `${indent}  `)}`
        : `${indent}${key}: ${Array.isArray(item) ? JSON.stringify(item) : String(item ?? '-')}`,
    )
    .join('\n');
}

/** Human output for a terminal; --json prints the result as one document instead. */
export function printResult(command: string, result: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (Array.isArray(result) && (result.length === 0 || isBackup(result[0]))) {
    if (result.length === 0) {
      process.stdout.write('No backups yet. Run: sudo bemmoly backup\n');
      return;
    }
    process.stdout.write(
      'CREATED (UTC)     KIND         STATUS        SIZE  VERIFIED  WHERE     VERSION\n',
    );
    for (const backup of result as Backup[]) process.stdout.write(`${backupLine(backup)}\n`);
    return;
  }
  if (isHealth(result)) {
    for (const check of result.checks) {
      const fix = check.fix && check.status !== 'ok' ? `  → ${check.fix.hint}` : '';
      process.stdout.write(`${MARK[check.status]} ${check.name.padEnd(24)} ${check.value}${fix}\n`);
    }
    return;
  }
  if (isBackup(result) && command === 'backup') {
    process.stdout.write(
      `✓ Backup ${result.status}: ${result.locations.map((l) => l.location).join(', ')} (${size(result.sizeBytes)}, ${result.attachmentMode} attachments)\n`,
    );
    return;
  }
  process.stdout.write(`${plain(result)}\n`);
}
