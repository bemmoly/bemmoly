import type { KernelSettingsService } from '@bemmoly/core';
import { CLI_ACTOR, UsageError } from './runtime.ts';

/**
 * What an installer may set before anyone signs in (Terraform's cloud-init, for one): how
 * email goes out and where backups go. Everything else is a person's choice in Settings.
 */
export const IMPORTABLE_SETTINGS: ReadonlySet<string> = new Set([
  'email.provider',
  'email.smtp.host',
  'email.smtp.port',
  'email.smtp.security',
  'email.smtp.username',
  'email.smtp.password',
  'email.from',
  'email.replyTo',
  'system.backups.s3',
  'system.backups.schedule',
  'system.backups.retention',
  'system.backups.encryption',
]);

type Settings = Pick<KernelSettingsService, 'catalog' | 'write'>;

function parseObject(text: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new UsageError('The settings file is not JSON');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new UsageError('The settings file must be one JSON object of setting key to value');
  return value as Record<string, unknown>;
}

/**
 * Imports `{ "<key>": <value>, … }`: every key and value is checked before the first is
 * written, so a bad file changes nothing. Secret values are encrypted like any other write.
 * Returns the keys, never the values.
 */
export async function importSettings(
  settings: Settings,
  text: string,
): Promise<{ imported: string[] }> {
  const entries = Object.entries(parseObject(text));
  const problems: string[] = [];
  for (const [key, value] of entries) {
    if (!IMPORTABLE_SETTINGS.has(key)) {
      problems.push(`${key}: not importable (allowed: ${[...IMPORTABLE_SETTINGS].join(', ')})`);
      continue;
    }
    const result = settings.catalog.get(key).definition.schema.safeParse(value);
    if (!result.success)
      problems.push(`${key}: ${result.error.issues.map((issue) => issue.message).join('; ')}`);
  }
  if (problems.length > 0) throw new UsageError(`Nothing imported:\n  ${problems.join('\n  ')}`);
  for (const [key, value] of entries) await settings.write(key, value, CLI_ACTOR);
  return { imported: entries.map(([key]) => key) };
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
