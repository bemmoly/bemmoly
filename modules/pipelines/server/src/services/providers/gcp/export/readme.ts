import type { ExportRecords } from '../../export-contract.ts';

/*
 * The README of one connection's directory: what is in it, how to adopt it without creating
 * anything twice, what to fill in first and what was left out. Plain words, as the guide in
 * docs/pipelines/export.md says them.
 */

/** Always true of an export, whatever the records hold. */
export const ALWAYS_LEFT_OUT = [
  'Revision history. Cloud Run and GKE keep earlier revisions so Pipelines can roll back; the export holds only the one serving traffic.',
  "The canary's weights while one is moving. Cloud Run's traffic is ignored by Terraform, and each HTTPRoute sends all traffic to the serving revision.",
  'Secret values. They live only in Secret Manager; the export names each secret and the version a service reads.',
  'The workload identity federation pool and the control project. bootstrap.sh made them, so they are already yours.',
  'The front door. Pipelines makes no load balancers yet; terraform/front-door.tf is where they will go.',
  'Build machines. A Cloud Build pool leaves nothing behind to import; terraform/build-pools.tf lists how each pool starts them.',
];

const bullets = (lines: readonly string[]) => lines.map((line) => `- ${line}`).join('\n');

export function readme(input: {
  records: ExportRecords;
  imports: number;
  groups: readonly string[];
  leftOut: readonly string[];
  toFill: readonly string[];
}): string {
  const { records, imports, groups } = input;
  const helm =
    groups.length === 0
      ? 'Nothing here runs on GKE, so there are no Helm charts.'
      : groups
          .map(
            (group) =>
              `- \`helm/${group}/\`: the ${group} namespace. Install the Gateway, then each application:\n\n` +
              '  ```sh\n' +
              `  helm upgrade --install ${group}-gateway helm/${group} -n ${group} -f helm/${group}/values/ENV/gateway.yaml\n` +
              `  helm upgrade --install APP helm/${group} -n ${group} -f helm/${group}/values/ENV/APP.yaml\n` +
              '  ```',
          )
          .join('\n');
  return `# ${records.connection.name}

Everything Bemmoly Pipelines created and deployed through this connection, as Terraform and
Helm you can run without Pipelines. Nothing here holds a secret value.

## Terraform

\`terraform/\` declares what exists today, with an import block for each of the ${imports}
resources so Terraform adopts them instead of creating them again. The values that differ
per company are in \`terraform.tfvars\`.

\`\`\`sh
cd terraform
terraform init
terraform plan
\`\`\`

You should see \`Plan: ${imports} to import, 0 to add, 0 to change, 0 to destroy.\` Run
\`terraform apply\` to record them in your state. From then on, change them here.

${input.toFill.length > 0 ? `## Before you plan\n\n${bullets(input.toFill)}\n\n` : ''}## Helm

${helm}

\`helm template\` shows what each would apply. Objects Pipelines made carry its labels; to let
Helm take them over in place, label and annotate them first:

\`\`\`sh
kubectl -n NAMESPACE label deployment,service,httproute,secretproviderclass,serviceaccount,gateway \\
  -l app.kubernetes.io/managed-by=bemmoly-pipelines app.kubernetes.io/managed-by=Helm --overwrite
kubectl -n NAMESPACE annotate deployment,service,httproute,secretproviderclass,serviceaccount \\
  -l app.kubernetes.io/name=APP meta.helm.sh/release-name=APP meta.helm.sh/release-namespace=NAMESPACE
\`\`\`

## Left out

${bullets([...ALWAYS_LEFT_OUT, ...input.leftOut])}
`;
}
