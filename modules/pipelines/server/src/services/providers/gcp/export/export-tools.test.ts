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
import type { PodPoolSite } from '../../runners-contract.ts';
import { poolNamespaceManifest, runnerServiceAccountManifest } from '../autopilot-manifests.ts';
import { gkeBackendName } from '../front-door-map.ts';
import { EXPORT_RECORDS } from './fixture.ts';
import { NEG_ANNOTATION } from './helm-templates.ts';

/*
 * The golden export checked by the tools a company would run on it, when this machine has
 * them: terraform fmt and validate, helm lint, and helm template, whose output must be the
 * very objects Pipelines' own deploy writes to GKE (labelled managed-by Helm instead).
 */

const TESTDATA = fileURLToPath(new URL('./testdata', import.meta.url));
/** A tool's first run on a fresh CI machine can take far longer than a test's default 5 s. */
const TOOL_MS = 120_000;

const has = (tool: string) => spawnSync('sh', ['-c', `command -v ${tool}`]).status === 0;
const run = (tool: string, args: string[], cwd = TESTDATA) => {
  const result = spawnSync(tool, args, { cwd, encoding: 'utf8', timeout: TOOL_MS });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
};

/** What Pipelines writes, as Helm would label it, with the API version the cluster reads. */
function asHelm(manifest: KubernetesManifest): Record<string, unknown> {
  const text = JSON.stringify(manifest).replaceAll(`"${MANAGED_BY}"`, '"Helm"');
  const kind = manifest.kind as keyof typeof KINDS;
  return { apiVersion: KINDS[kind].apiVersion, ...(JSON.parse(text) as object) };
}

describe.runIf(has('terraform'))('the Terraform, with terraform', { timeout: TOOL_MS }, () => {
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

describe.runIf(has('helm'))('the Helm chart, with helm', { timeout: TOOL_MS }, () => {
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
    const neg = gkeBackendName(namespace, revision);
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
      // The front door routes to this revision, so GKE was asked for its endpoint group.
      {
        ...kubeService,
        metadata: {
          ...kubeService.metadata,
          annotations: {
            [NEG_ANNOTATION]: JSON.stringify({ exposed_ports: { '80': { name: neg } } }),
          },
        },
      },
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

  it("renders each Autopilot pool's namespace and service account as Pipelines makes them", () => {
    const pool = EXPORT_RECORDS.pools.find((p) => p.kind === 'gke-autopilot');
    if (pool?.kind !== 'gke-autopilot') throw new Error('fixture has no Autopilot pool');
    const pools = join('helm', 'runner-pools');
    const values = join(pools, `values/${pool.key}.yaml`);
    const lint = run('helm', ['lint', pools, '-f', values]);
    expect(lint.ok, lint.output).toBe(true);
    const rendered = run('helm', ['template', pool.key, pools, '-n', pool.namespace, '-f', values]);
    expect(rendered.ok, rendered.output).toBe(true);
    const docs = parseAllDocuments(rendered.output).map((doc) => doc.toJSON() as object);
    const site = {
      pool: pool.key,
      namespace: pool.namespace,
      serviceAccount: pool.serviceAccount,
    } as PodPoolSite;
    const expected = [poolNamespaceManifest(site), runnerServiceAccountManifest(site)].map(asHelm);
    expect(docs).toHaveLength(2);
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
