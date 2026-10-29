import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAllDocuments } from 'yaml';
import { describe, expect, it } from 'vitest';
import type { KubernetesManifest } from '../../../../clients/kubernetes/index.ts';
import { KINDS } from '../../../../clients/kubernetes/resources.ts';
import {
  gatewayManifest,
  LABELS,
  MANAGED_BY,
  revisionLabels,
  revisionManifests,
  routeManifest,
} from '../gke-manifests.ts';
import { secretClassManifest, secretsOf, serviceAccountManifest } from '../gke-secrets.ts';
import { EXPORT_RECORDS } from './fixture.ts';

/*
 * The golden export checked by the tools a company would run on it, when this machine has
 * them: terraform fmt and validate, helm lint, and helm template, whose output must be the
 * very objects Pipelines' own deploy writes to GKE (labelled managed-by Helm instead).
 */

const TESTDATA = fileURLToPath(new URL('./testdata', import.meta.url));
const has = (tool: string) => spawnSync('sh', ['-c', `command -v ${tool}`]).status === 0;
const run = (tool: string, args: string[], cwd = TESTDATA) => {
  const result = spawnSync(tool, args, { cwd, encoding: 'utf8', timeout: 120_000 });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
};

/** What Pipelines writes, as Helm would label it, with the API version the cluster reads. */
function asHelm(manifest: KubernetesManifest): Record<string, unknown> {
  const text = JSON.stringify(manifest).replaceAll(`"${MANAGED_BY}"`, '"Helm"');
  const kind = manifest.kind as keyof typeof KINDS;
  return { apiVersion: KINDS[kind].apiVersion, ...(JSON.parse(text) as object) };
}

describe.runIf(has('terraform'))('the Terraform, with terraform', () => {
  it('is formatted and valid', () => {
    const work = mkdtempSync(join(tmpdir(), 'bemmoly-export-'));
    try {
      cpSync(join(TESTDATA, 'terraform'), work, { recursive: true });
      expect(run('terraform', ['fmt', '-check', '-diff', '-recursive'], work).output).toBe('');
      const init = run('terraform', ['init', '-backend=false', '-input=false', '-no-color'], work);
      expect(init.ok, init.output).toBe(true);
      const valid = run('terraform', ['validate', '-no-color'], work);
      expect(valid.ok, valid.output).toBe(true);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }, 180_000);
});

describe.runIf(has('helm'))('the Helm chart, with helm', () => {
  const chart = join('helm', 'checkout');

  it('lints clean', () => {
    const lint = run('helm', [
      'lint',
      chart,
      '-f',
      join(chart, 'values/prod/payments-worker.yaml'),
    ]);
    expect(lint.ok, lint.output).toBe(true);
    expect(lint.output).toContain('0 chart(s) failed');
  });

  it('renders exactly what Pipelines deploys for the application', () => {
    const service = EXPORT_RECORDS.services.find((s) => s.application === 'payments-worker');
    if (!service) throw new Error('fixture has no GKE service');
    const { application, revision, release, variables } = service;
    const namespace = service.placement.namespace;
    const rendered = run('helm', [
      'template',
      application,
      chart,
      '-n',
      namespace,
      '-f',
      join(chart, `values/prod/${application}.yaml`),
    ]);
    expect(rendered.ok, rendered.output).toBe(true);
    const docs = parseAllDocuments(rendered.output).map((doc) => doc.toJSON() as object);
    const { deployment, service: kubeService } = revisionManifests({
      application,
      namespace,
      revision,
      release,
      variables,
      serviceAccount: application,
    });
    const expected = [
      serviceAccountManifest(application, namespace, {
        [LABELS.application]: application,
        [LABELS.managedBy]: MANAGED_BY,
      }),
      kubeService,
      deployment,
      routeManifest({
        application,
        namespace,
        gateway: null,
        backends: [{ revision, weight: 100 }],
      }),
      secretClassManifest({
        revision,
        namespace,
        labels: revisionLabels(application, revision),
        secrets: secretsOf(variables),
      }),
    ].map(asHelm);
    expect(docs).toHaveLength(expected.length);
    expect(docs).toEqual(expect.arrayContaining(expected));
  });

  it("renders the group's Gateway as its own release", () => {
    const rendered = run('helm', [
      'template',
      'checkout-gateway',
      chart,
      '-n',
      'checkout',
      '-f',
      join(chart, 'values/prod/gateway.yaml'),
    ]);
    expect(rendered.ok, rendered.output).toBe(true);
    const docs = parseAllDocuments(rendered.output).map((doc) => doc.toJSON() as object);
    expect(docs).toEqual([asHelm(gatewayManifest('checkout'))]);
  });
});
