import type {
  ExportBundle,
  ExportFacts,
  ExportPart,
  ExportRecords,
  ExportService,
} from '../../export-contract.ts';
import { imageOf } from '../container.ts';
import type { GcpContexts } from '../context.ts';
import { helmFiles } from './helm.ts';
import { nameOf } from './hcl.ts';
import { readme } from './readme.ts';
import { createTerraform } from './terraform-context.ts';
import { terraformFiles } from './terraform-files.ts';
import { clusters } from './terraform-gke.ts';
import { identities } from './terraform-identity.ts';
import { services } from './terraform-run.ts';
import { secrets } from './terraform-secrets.ts';
import { landingZone } from './terraform-zone.ts';

/*
 * Export on Google Cloud: Terraform for the landing zone, identities, registry, secrets,
 * Cloud Run services and clusters, and Helm for what runs on GKE. `exportFiles` is pure; the
 * read before it asks Google for each project's number and parent and each budget's name.
 */

/** A service whose release names no image Google can pull is left out, saying why. */
function deployable(records: ExportRecords) {
  const kept: ExportService[] = [];
  const leftOut: string[] = [];
  for (const service of records.services) {
    try {
      imageOf(service.release);
      kept.push(service);
    } catch (error) {
      leftOut.push(
        `${service.application} in ${service.environment.key}: ${(error as Error).message}.`,
      );
    }
  }
  return { kept, leftOut };
}

export function exportFiles(records: ExportRecords, facts: ExportFacts): ExportBundle {
  const { kept, leftOut } = deployable(records);
  const tf = createTerraform({ ...records, services: kept }, facts);
  landingZone(tf);
  identities(tf);
  secrets(tf);
  services(tf);
  clusters(tf);
  const terraform = terraformFiles(tf);
  const helm = helmFiles(kept);
  const missing = [
    ...[...tf.numbers]
      .filter((account) => !facts.accounts[account]?.number)
      .map(
        (account) =>
          `Fill project_numbers.${nameOf(account)} in terraform.tfvars: gcloud projects describe ${account} --format='value(projectNumber)'`,
      ),
    ...[...tf.folders]
      .filter(([, id]) => !id)
      .map(
        ([name]) =>
          `Fill folders.${name} in terraform.tfvars with the folder's ID: gcloud resource-manager folders list --folder=FOLDER_ID`,
      ),
  ];
  const toFill = [...facts.problems, ...missing, ...tf.fill];
  const allLeftOut = [...records.leftOut, ...leftOut];
  const groups = [...new Set(helm.map((file) => file.path.split('/')[1] ?? ''))].filter(Boolean);
  return {
    files: [
      {
        path: 'README.md',
        content: readme({
          records,
          imports: tf.imports.length,
          groups,
          leftOut: allLeftOut,
          toFill,
        }),
      },
      ...terraform,
      ...helm,
    ],
    leftOut: allLeftOut,
    toFill,
  };
}

/** Project numbers and parents, and budget names, read as the control identity. */
export function createGcpExport(contexts: GcpContexts): ExportPart {
  return {
    files: exportFiles,
    async read(connection, records) {
      const accounts: Record<string, { number: string | null; parent: string | null }> = {};
      const budgets: Record<string, string> = {};
      const problems: string[] = [];
      let context: ReturnType<GcpContexts>;
      try {
        context = contexts(connection);
      } catch (error) {
        return { accounts, budgets, problems: [(error as Error).message] };
      }
      const wanted = new Set([
        ...records.accounts.map((account) => account.externalId),
        ...records.clusters.map((cluster) => cluster.projectId),
      ]);
      for (const account of wanted) {
        try {
          const project = await context.control.resourceManager.getProject(account);
          accounts[account] = {
            number: project?.name.split('/').pop() ?? null,
            parent: project?.parent ?? null,
          };
        } catch (error) {
          problems.push(`Pipelines could not read ${account}: ${(error as Error).message}`);
        }
      }
      for (const resource of records.resources.filter((r) => r.kind === 'budget')) {
        try {
          const found = await context.control.budgets.findByName(
            context.config.billingAccountId,
            `Bemmoly ${resource.account}`,
          );
          if (found) budgets[resource.account] = found.name;
        } catch (error) {
          problems.push(
            `Pipelines could not read the budget for ${resource.account}: ${(error as Error).message}`,
          );
        }
      }
      return { accounts, budgets, problems };
    },
  };
}
