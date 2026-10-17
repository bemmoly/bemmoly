import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import { afterEach, describe, expect, it } from 'vitest';
import { createDiskObjectStore } from '../services/storage/index.ts';
import { ModuleLoadError } from './errors.ts';
import { createModuleObjects } from './objects.ts';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function diskStore() {
  const root = await mkdtemp(join(tmpdir(), 'bemmoly-objects-'));
  roots.push(root);
  return createDiskObjectStore({ root });
}

describe('module objects', () => {
  it('keeps every key under the module prefix and hands keys back without it', async () => {
    const store = await diskStore();
    const objects = createModuleObjects('pipelines', () => store);
    const body = new TextEncoder().encode('line one\n');
    const put = await objects.put({ key: 'logs/job/0', body, contentType: 'text/plain' });
    expect(put.key).toBe('logs/job/0');
    expect(await store.head('modules/pipelines/logs/job/0')).not.toBeNull();
    expect(await text((await objects.get('logs/job/0')).body)).toBe('line one\n');
    const listed = await objects.list('logs/');
    expect(listed.items.map((item) => item.key)).toEqual(['logs/job/0']);
    await objects.delete('logs/job/0');
    expect(await objects.head('logs/job/0')).toBeNull();
  });

  it('fails loudly when the process has no object store', async () => {
    const objects = createModuleObjects('pipelines', () => undefined);
    await expect(objects.head('anything')).rejects.toBeInstanceOf(ModuleLoadError);
  });
});
