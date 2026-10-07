import { describe, expect, it } from 'vitest';
import { planAttachments, type PreviousBackup } from './attachments.ts';
import {
  buildManifest,
  manifestSize,
  parseManifest,
  setNameFor,
  type ManifestInput,
} from './manifest.ts';

const SHA = 'a'.repeat(64);
const part = (file: string, size: number) => ({
  file,
  sizeBytes: size,
  sha256: SHA,
  plainSizeBytes: size,
  plainSha256: SHA,
});

const input = (overrides: Partial<ManifestInput> = {}): ManifestInput => ({
  id: '01999999-0000-7000-8000-00000000abcd',
  setName: 'bemmoly-20261007-020000-scheduled-0000abcd',
  kind: 'scheduled',
  createdAt: new Date('2026-10-07T02:00:00Z'),
  appVersion: '1.2.0',
  changelogTag: 'pre-upgrade-1.1.0',
  modules: ['work', 'docs'],
  database: { ...part('database.dump', 1_000), serverVersion: '18.1', rowCounts: { users: 3 } },
  attachments: {
    mode: 'full',
    chain: ['bemmoly-20261007-020000-scheduled-0000abcd'],
    chainStartedAt: new Date('2026-10-07T02:00:00Z'),
    fileCount: 2,
    totalFileCount: 2,
    archive: part('attachments.tar', 500),
    index: 'attachments.index.json',
  },
  encryption: null,
  ...overrides,
});

describe('buildManifest', () => {
  it('records version, tag, sorted modules, sizes, checksums and instructions', () => {
    const manifest = buildManifest(input());
    expect(manifest).toMatchObject({
      format: 1,
      appVersion: '1.2.0',
      changelogTag: 'pre-upgrade-1.1.0',
      modules: ['docs', 'work'],
      database: { format: 'pg_dump-custom', sha256: SHA, rowCounts: { users: 3 } },
      encryption: null,
    });
    expect(manifestSize(manifest)).toBe(1_500);
    expect(manifest.instructions.join('\n')).toContain('/var/bemmoly/.env');
    expect(manifest.instructions.join('\n')).toContain(`bemmoly restore ${manifest.setName}`);
    expect(parseManifest(JSON.stringify(manifest))).toEqual(manifest);
  });

  it('says where the passphrase lives and which sets an incremental needs', () => {
    const manifest = buildManifest(
      input({
        encryption: { algorithm: 'aes-256-gcm-stream-v1' },
        attachments: {
          ...input().attachments,
          mode: 'incremental',
          chain: ['set-a', 'set-b', input().setName],
        },
      }),
    );
    expect(manifest.encryption).toEqual({
      algorithm: 'aes-256-gcm-stream-v1',
      kdf: 'scrypt',
      passphraseSource: 'BEMMOLY_BACKUP_PASSPHRASE in /var/bemmoly/.env',
    });
    expect(manifest.instructions.join('\n')).toContain('set-a, set-b');
  });

  it('names sets so they sort by time', () => {
    expect(
      setNameFor(
        '01999999-0000-7000-8000-00000000abcd',
        'pre_upgrade',
        new Date('2026-10-07T02:03:04.567Z'),
      ),
    ).toBe('bemmoly-20261007-020304-pre-upgrade-0000abcd');
  });
});

describe('planAttachments', () => {
  const now = new Date('2026-10-20T02:00:00Z');
  const previous: PreviousBackup = {
    id: 'prev',
    setName: 'bemmoly-20261019-020000-scheduled-00000001',
    chain: [
      'bemmoly-20261001-020000-scheduled-00000000',
      'bemmoly-20261019-020000-scheduled-00000001',
    ],
    chainStartedAt: new Date('2026-10-01T02:00:00Z'),
    index: new Map([
      ['aa/aa', 10],
      ['bb/bb', 20],
    ]),
  };
  const current = new Map([
    ['aa/aa', 10],
    ['bb/bb', 20],
    ['cc/cc', 30],
  ]);

  it('copies only new files within the month', () => {
    const plan = planAttachments({ setName: 'this', current, previous, forceFull: false, now });
    expect(plan).toMatchObject({
      mode: 'incremental',
      files: ['cc/cc'],
      bytes: 30,
      baseBackupId: 'prev',
    });
    expect(plan.chain).toEqual([...previous.chain, 'this']);
  });

  it('starts a full chain in a new month, for pre-upgrade runs and without a previous backup', () => {
    const nextMonth = new Date('2026-11-01T02:00:00Z');
    expect(
      planAttachments({ setName: 'this', current, previous, forceFull: false, now: nextMonth })
        .mode,
    ).toBe('full');
    expect(planAttachments({ setName: 'this', current, previous, forceFull: true, now }).mode).toBe(
      'full',
    );
    const first = planAttachments({
      setName: 'this',
      current,
      previous: null,
      forceFull: false,
      now,
    });
    expect(first).toMatchObject({ mode: 'full', chain: ['this'], bytes: 60, baseBackupId: null });
  });

  it('keeps the previous chain when nothing is new', () => {
    const plan = planAttachments({
      setName: 'this',
      current: previous.index,
      previous,
      forceFull: false,
      now,
    });
    expect(plan).toMatchObject({ mode: 'incremental', files: [], chain: previous.chain });
  });
});
