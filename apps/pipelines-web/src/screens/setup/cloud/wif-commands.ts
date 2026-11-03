/*
 * "With gcloud": the console steps for a workload identity file as commands, filled in from
 * what the person typed. Placeholders stay in capitals until then, so a half-filled command
 * reads as unfinished rather than looking runnable.
 */

export interface WifInput {
  projectId: string;
  projectNumber: string;
  runsOn: 'oidc' | 'aws';
  issuer: string;
  awsAccount: string;
  tokenPath: string;
}

export const EMPTY_WIF: WifInput = {
  projectId: '',
  projectNumber: '',
  runsOn: 'oidc',
  issuer: '',
  awsAccount: '',
  tokenPath: '/var/run/secrets/bemmoly/token',
};

const or = (value: string, placeholder: string) => value.trim() || placeholder;

export function wifCommands(input: WifInput): string {
  const project = or(input.projectId, 'PROJECT_ID');
  const number = or(input.projectNumber, 'PROJECT_NUMBER');
  const pool = `projects/${number}/locations/global/workloadIdentityPools/bemmoly`;
  const account = `bemmoly@${project}.iam.gserviceaccount.com`;
  const where = `--project=${project} --location=global`;
  const provider =
    input.runsOn === 'oidc'
      ? `gcloud iam workload-identity-pools providers create-oidc bemmoly ${where} \\\n  --workload-identity-pool=bemmoly --issuer-uri=${or(input.issuer, 'ISSUER_URL')} \\\n  --attribute-mapping=google.subject=assertion.sub`
      : `gcloud iam workload-identity-pools providers create-aws bemmoly ${where} \\\n  --workload-identity-pool=bemmoly --account-id=${or(input.awsAccount, 'AWS_ACCOUNT_ID')} \\\n  --attribute-mapping=google.subject=assertion.sub`;
  const source =
    input.runsOn === 'oidc'
      ? `--credential-source-file=${or(input.tokenPath, 'TOKEN_PATH')}`
      : '--aws';
  return [
    `gcloud iam workload-identity-pools create bemmoly ${where} --display-name=bemmoly`,
    provider,
    `gcloud iam service-accounts create bemmoly --project=${project}`,
    `gcloud iam service-accounts add-iam-policy-binding ${account} --project=${project} \\\n  --role=roles/iam.workloadIdentityUser \\\n  --member="principalSet://iam.googleapis.com/${pool}/*"`,
    `gcloud iam workload-identity-pools create-cred-config ${pool}/providers/bemmoly \\\n  --service-account=${account} ${source} \\\n  --output-file=bemmoly-wif.json`,
  ].join('\n');
}
