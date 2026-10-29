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
      'helm/checkout/values/prod/payments-worker.yaml',
      'helm/checkout/values/prod/gateway.yaml',
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
    expect(bundle.leftOut).toEqual(EXPORT_RECORDS.leftOut);
    expect(file('README.md')).toContain("The canary's weights");
    expect(bundle.toFill).toEqual([
      expect.stringMatching(/^payments-worker in prod: a deploy after v2\.1\.0 did not finish/),
    ]);
  });

  it('asks a person for what the cloud could not tell', () => {
    const blind = exportFiles(EXPORT_RECORDS, NO_FACTS);
    expect(blind.toFill).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Fill project_numbers.acme_prod_7f3a in terraform.tfvars'),
        expect.stringContaining('Fill folders.commerce in terraform.tfvars'),
        expect.stringContaining('The budget for acme-prod-7f3a is declared without an import'),
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
