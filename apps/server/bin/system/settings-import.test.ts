import {
  createSettingsCatalog,
  EMAIL_SETTING_DEFINITIONS,
  KERNEL_SETTINGS,
  SYSTEM_SETTINGS,
} from '@bemmoly/core';
import { describe, expect, it } from 'vitest';
import { importSettings } from './settings-import.ts';

function fakeSettings() {
  const written: [string, unknown][] = [];
  const settings = {
    catalog: createSettingsCatalog(undefined, [
      ...KERNEL_SETTINGS,
      ...EMAIL_SETTING_DEFINITIONS,
      ...SYSTEM_SETTINGS,
    ]),
    write: async (key: string, value: unknown) => {
      written.push([key, value]);
      return {} as never;
    },
  };
  return { settings, written };
}

const S3 = {
  enabled: true,
  endpoint: 'https://objects.example.com',
  region: 'eu-central-1',
  bucket: 'bemmoly-backups',
  prefix: 'bemmoly/',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
  forcePathStyle: true,
};

describe('importSettings', () => {
  it('writes SMTP and S3 backup settings and reports only the keys', async () => {
    const { settings, written } = fakeSettings();
    const result = await importSettings(
      settings,
      JSON.stringify({
        'email.provider': 'smtp',
        'email.smtp.host': 'smtp.example.com',
        'email.smtp.port': 587,
        'email.smtp.password': 'not-a-real-password',
        'system.backups.s3': S3,
      }),
    );
    expect(result).toEqual({
      imported: [
        'email.provider',
        'email.smtp.host',
        'email.smtp.port',
        'email.smtp.password',
        'system.backups.s3',
      ],
    });
    expect(JSON.stringify(result)).not.toContain('not-a-real-password');
    expect(written).toContainEqual(['system.backups.s3', S3]);
  });

  it('changes nothing when one value is invalid', async () => {
    const { settings, written } = fakeSettings();
    await expect(
      importSettings(
        settings,
        JSON.stringify({ 'email.smtp.host': 'smtp.example.com', 'email.smtp.port': 'seven' }),
      ),
    ).rejects.toThrow(/Nothing imported:[\s\S]*email\.smtp\.port/);
    expect(written).toEqual([]);
  });

  it('refuses keys outside email and backups', async () => {
    const { settings, written } = fakeSettings();
    await expect(
      importSettings(settings, JSON.stringify({ 'system.updates.manifestUrl': 'https://x.test' })),
    ).rejects.toThrow(/system\.updates\.manifestUrl: not importable/);
    expect(written).toEqual([]);
  });

  it('wants one JSON object', async () => {
    const { settings } = fakeSettings();
    await expect(importSettings(settings, 'smtp=yes')).rejects.toThrow(/not JSON/);
    await expect(importSettings(settings, '[]')).rejects.toThrow(/one JSON object/);
  });
});
