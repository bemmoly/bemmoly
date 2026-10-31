import { describe, expect, it } from 'vitest';
import { NO_FACTS } from '../../export-contract.ts';
import { EXPORT_FACTS, EXPORT_RECORDS } from './fixture.ts';
import { exportFiles } from './index.ts';

/*
 * The export of a fixed landing zone, file by file, against the golden copies in testdata/
 * (vitest -u rewrites them after a deliberate change). The same records always give the same
 * files, and what the cloud could not tell becomes a value to fill in, never a guess.
 */

const bundle = exportFiles(EXPORT_RECORDS, EXPORT_FACTS);
const file = (path: string) => bundle.files.find((entry) => entry.path === path)?.content ?? '';

describe('the Google Cloud export', () => {
  it('writes the Terraform, Helm and README a company runs without Pipelines', () => {
    expect(bundle.files.map((entry) => entry.path)).toEqual([
      'README.md',
      'terraform/versions.tf',
      'terraform/landing-zone.tf',
      'terraform/identities.tf',
      'terraform/registry.tf',
      'terraform/secrets.tf',
      'terraform/cloud-run.tf',
      'terraform/clusters.tf',
      'terraform/build-pools.tf',
      'terraform/front-door.tf',
      'terraform/imports.tf',
      'terraform/variables.tf',
      'terraform/terraform.tfvars',
      'helm/checkout/Chart.yaml',
      'helm/checkout/values.yaml',
      'helm/checkout/templates/_helpers.tpl',
      'helm/checkout/templates/deployment.yaml',
      'helm/checkout/templates/service.yaml',
      'helm/checkout/templates/httproute.yaml',
      'helm/checkout/templates/secretproviderclass.yaml',
      'helm/checkout/templates/serviceaccount.yaml',
      'helm/checkout/templates/gateway.yaml',
      'helm/checkout/templates/horizontalpodautoscaler.yaml',
      'helm/checkout/templates/poddisruptionbudget.yaml',
      'helm/checkout/templates/secretsync.yaml',
      'helm/checkout/templates/stable-service.yaml',
      'helm/checkout/values/prod/payments-worker.yaml',
      'helm/checkout/values/prod/gateway.yaml',
      'helm/runner-pools/Chart.yaml',
      'helm/runner-pools/values.yaml',
      'helm/runner-pools/templates/namespace.yaml',
      'helm/runner-pools/templates/serviceaccount.yaml',
      'helm/runner-pools/values/gke-runners.yaml',
    ]);
  });

  it.each(bundle.files.map((entry) => [entry.path, entry.content]))(
    'matches the golden %s',
    async (path, content) => {
      await expect(content).toMatchFileSnapshot(`./testdata/${path}`);
    },
  );

  it('is the same every time for the same records', () => {
    expect(exportFiles(EXPORT_RECORDS, EXPORT_FACTS)).toEqual(bundle);
  });

  it('adopts each resource with an import block, and pins the provider', () => {
    const imports = file('terraform/imports.tf').match(/^import \{$/gm) ?? [];
    expect(imports.length).toBeGreaterThan(30);
    expect(file('README.md')).toContain(`Plan: ${imports.length} to import, 0 to add`);
    expect(file('terraform/versions.tf')).toContain('version = "~> 8.0"');
    expect(file('terraform/landing-zone.tf')).not.toContain('bemmoly-control-583920174411"');
  });

  it('names secrets by reference and version, and the canary is left out', () => {
    expect(file('terraform/cloud-run.tf')).toContain('version = "3"');
    expect(file('terraform/secrets.tf')).not.toMatch(
      /secret_data|google_secret_manager_secret_version/,
    );
    expect(bundle.leftOut.slice(-1)).toEqual(EXPORT_RECORDS.leftOut);
    expect(bundle.leftOut[0]).toMatch(/^Revision history\./);
    expect(file('README.md')).toContain("The canary's weights");
    expect(bundle.toFill).toEqual([
      expect.stringMatching(
        /^Traffic is still shifting on checkout-api\.prod\.acme\.example in prod,/,
      ),
      expect.stringMatching(
        /^A deploy did not finish since the exported release of payments-worker in prod,/,
      ),
    ]);
  });

  it("declares each front door, with a moving host's traffic on its heaviest backend", () => {
    const door = file('terraform/front-door.tf');
    for (const type of [
      'google_compute_global_address',
      'google_compute_global_forwarding_rule',
      'google_compute_target_https_proxy',
      'google_compute_url_map',
      'google_compute_backend_service',
      'google_compute_region_network_endpoint_group',
      'google_compute_health_check',
      'google_compute_managed_ssl_certificate',
    ]) {
      expect(door).toContain(`resource "${type}"`);
      expect(file('terraform/imports.tf')).toContain(`to = ${type}.`);
    }
    expect(door).not.toContain('weight          = 70');
    expect(door).not.toContain('checkout-api-v1-43-0-a1c9e3f');
    expect(door.match(/data "google_compute_network_endpoint_group"/g)).toHaveLength(2);
    expect(file('helm/checkout/values/prod/payments-worker.yaml')).toContain(
      'neg: fd-checkout-payments-worker-v2-1-0-a1c9e3f-80',
    );
  });

  it('keeps an Autopilot pool: its cluster, the pods binding and its namespace chart', () => {
    const pools = file('terraform/build-pools.tf');
    expect(pools).toContain('resource "google_container_cluster" "bemmoly_runners"');
    expect(pools).toContain('roles/iam.workloadIdentityUser');
    expect(pools).toContain('[bemmoly-runners-gke-runners/bemmoly-runner]');
    expect(file('README.md')).toContain('-n bemmoly-runners-gke-runners');
  });

  it('asks a person for what the cloud could not tell', () => {
    const blind = exportFiles(EXPORT_RECORDS, NO_FACTS);
    expect(blind.toFill).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Fill project_numbers.acme_prod_7f3a in terraform.tfvars'),
        expect.stringContaining('Fill folders.commerce in terraform.tfvars'),
        expect.stringContaining('The budget for acme-prod-7f3a is declared without an import'),
        expect.stringContaining('Add a backend to fd-checkout-payments-worker-v2-1-0-a1c9e3f-80'),
      ]),
    );
    const tfvars = blind.files.find((entry) => entry.path === 'terraform/terraform.tfvars');
    expect(tfvars?.content).toContain('acme_prod_7f3a = ""');
  });

  it('leaves out a release Google cannot pull, saying why', () => {
    const [first] = EXPORT_RECORDS.services;
    if (!first) throw new Error('fixture has no services');
    const local = {
      ...first,
      release: { ...first.release, imageRepository: 'bemmoly-local/checkout-api' },
    };
    const result = exportFiles({ ...EXPORT_RECORDS, services: [local] }, EXPORT_FACTS);
    expect(result.leftOut.at(-1)).toMatch(
      /^checkout-api in prod: Release v1\.43\.0 was built into/,
    );
    expect(result.files.some((entry) => entry.path === 'terraform/cloud-run.tf')).toBe(false);
  });
});
