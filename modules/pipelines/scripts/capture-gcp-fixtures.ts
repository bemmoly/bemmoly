#!/usr/bin/env node
/**
 * pnpm --filter @bemmoly/module-pipelines capture:gcp --folder 417302018845 \
 *   --billing 01A2B3-C4D5E6-F7A8B9 --control-project bemmoly-control-583920174411 [--apply]
 *
 * Runs managed mode against a sandbox organisation with your own gcloud sign-in (run
 * `gcloud auth application-default login` first) and writes what Google answered as fixture
 * files, to replace the hand-written ones in server/src/clients/gcp/fixtures. Without --apply
 * it only reads: the connection check, the billing count, and a read of every resource of a
 * Starter landing zone. With --apply it also creates that zone: two projects, billed to the
 * account, in the folder. Delete them afterwards; nothing here deletes anything.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildZone } from '../server/src/services/clouds/layout.ts';
import { inDependencyOrder } from '../server/src/services/clouds/order.ts';
import type { ConnectionRecord } from '../server/src/services/providers/contract.ts';
import { createGcpProvider } from '../server/src/services/providers/gcp/index.ts';
import { createRecordingTransport } from '../server/src/testing/gcp-record.ts';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    folder: { type: 'string' },
    billing: { type: 'string' },
    'control-project': { type: 'string' },
    region: { type: 'string', default: 'us-central1' },
    out: { type: 'string', default: 'captured-gcp' },
    apply: { type: 'boolean', default: false },
  },
});
const out = (line: string) => process.stdout.write(`[capture] ${line}\n`);
if (!values.folder || !values.billing || !values['control-project']) {
  out('Pass --folder, --billing and --control-project, as bootstrap.sh printed them.');
  process.exit(1);
}

const recorder = createRecordingTransport();
const provider = createGcpProvider({ transport: recorder.transport });
const connection: ConnectionRecord = {
  id: '0199f0aa-0000-7000-8000-00000000ca97',
  provider: 'gcp',
  name: 'Capture',
  layout: 'starter',
  boundaryRef: `folders/${values.folder}`,
  config: {
    mode: 'managed',
    folderId: values.folder,
    billingAccountId: values.billing,
    controlProject: values['control-project'],
    region: values.region,
    credentials: { kind: 'application_default' },
  },
};
mkdirSync(values.out, { recursive: true });
const save = (name: string) => {
  const file = join(values.out, `${name}.json`);
  const note = `Captured from a sandbox organisation on ${new Date().toISOString().slice(0, 10)} by scripts/capture-gcp-fixtures.ts`;
  writeFileSync(file, `${JSON.stringify(recorder.take(note), null, 2)}\n`);
  out(`wrote ${file}`);
};

const check = await provider.connection?.verify(connection);
out(`check: ${check?.ok ? 'ok' : (check?.problems.join(' ') ?? 'no connection part')}`);
save('managed-check');
const billing = await provider.org?.billing?.(connection);
out(`billing: ${billing?.linked ?? '?'} projects linked`);
save('managed-billing');

const zone = buildZone({
  connection,
  environments: [
    { id: 'capture-dev', key: 'dev', name: 'Dev', class: 'dev' },
    { id: 'capture-prod', key: 'prod', name: 'Prod', class: 'prod' },
  ],
  domains: [],
  groups: [],
});
const landingZone = provider.landingZone;
if (!landingZone) throw new Error('The Google Cloud provider has no landing zone part');
for (const resource of inDependencyOrder(zone.resources)) {
  const label = `${resource.kind}/${resource.name}@${resource.account}`;
  try {
    const seen = await landingZone.read(connection, resource);
    const problems = seen ? landingZone.diff(resource, seen) : ['missing'];
    if (values.apply && problems.length > 0) await landingZone.apply(connection, resource);
    out(
      `${label}: ${problems.length === 0 ? 'matches' : values.apply ? 'applied' : problems.join('; ')}`,
    );
  } catch (error) {
    out(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    if (values.apply) break;
  }
}
save(values.apply ? 'managed-apply' : 'managed-read');
out('Review each file for anything private before committing it beside the hand-written ones.');
