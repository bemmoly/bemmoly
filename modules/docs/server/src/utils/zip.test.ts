import { describe, expect, it } from 'vitest';
import { readZip } from '../testing/read-zip.ts';
import { createZip } from './zip.ts';

describe('createZip', () => {
  it('writes entries any unzip can read back, names in UTF-8', () => {
    const zip = createZip([
      { name: 'Runbook.md', data: '# Runbook\n\nRestart the worker.\n' },
      { name: 'Runbook/Déploiement.md', data: 'é'.repeat(2000) },
      { name: 'empty.md', data: '' },
    ]);
    expect(zip.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(readZip(zip)).toEqual({
      'Runbook.md': '# Runbook\n\nRestart the worker.\n',
      'Runbook/Déploiement.md': 'é'.repeat(2000),
      'empty.md': '',
    });
  });

  it('writes an empty archive', () => {
    expect(readZip(createZip([]))).toEqual({});
  });
});
