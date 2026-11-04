/*
 * The commands the guided steps show, each built from values already checked. Nothing here
 * decides which roles Bemmoly gets: the grant comes from grantCommand() and the folder roles
 * from bootstrap.sh itself, so narrowing either reaches this screen unchanged.
 */

/** The control identity bootstrap.sh makes in the control project. */
export const CONTROL_ACCOUNT = 'bemmoly-control';
export const REPOSITORY = 'https://github.com/bemmoly/bemmoly.git';
export const CLOUD_SHELL = 'https://shell.cloud.google.com/?show=terminal';

export const controlEmail = (project: string) =>
  `${CONTROL_ACCOUNT}@${project}.iam.gserviceaccount.com`;

/** A shell word: as it is when it is plain, in single quotes otherwise. */
export const shellWord = (value: string) =>
  /^[A-Za-z0-9@%+=:,./_-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;

export interface BootstrapInput {
  organizationId: string;
  billingAccountId: string;
  folderName: string;
  controlProject: string;
  region: string;
}

/**
 * Fetches the script into Cloud Shell's home and runs it. `--mode none`: Bemmoly runs already,
 * so the script makes no VM for it.
 */
export function bootstrapCommand(input: BootstrapInput): string {
  return [
    `git clone --depth 1 ${REPOSITORY} ~/bemmoly 2>/dev/null || git -C ~/bemmoly pull --ff-only`,
    `sh ~/bemmoly/deploy/gcp/bootstrap.sh --org ${input.organizationId} --billing ${input.billingAccountId} \\`,
    `  --folder-name ${shellWord(input.folderName)} --control-project ${input.controlProject} \\`,
    `  --region ${input.region} --mode none`,
  ].join('\n');
}

/** Lets one person act as a service account; that account must exist. */
export function tokenCreatorCommand(account: string, project: string, you: string): string {
  return [
    `gcloud iam service-accounts add-iam-policy-binding ${account} --project=${project} \\`,
    `  --member=user:${you} --role=roles/iam.serviceAccountTokenCreator`,
  ].join('\n');
}

/** Makes a service account for an attached connection when there is none yet. */
export function serviceAccountCommand(account: string, project: string, you: string): string {
  const name = account.split('@')[0] ?? account;
  return [
    `gcloud iam service-accounts describe ${account} --project=${project} >/dev/null 2>&1 || \\`,
    `  gcloud iam service-accounts create ${name} --project=${project} --display-name=Bemmoly`,
    tokenCreatorCommand(account, project, you),
  ].join('\n');
}

export const signInCommand = (account: string) =>
  `gcloud auth application-default login --impersonate-service-account=${account}`;

/** Lets Bemmoly's container read the sign-in step 3 saved; read-only, nothing else changes. */
export const COMPOSE_OVERRIDE = [
  'cat > docker-compose.override.yml <<EOF',
  'services:',
  '  bemmoly:',
  '    volumes:',
  '      - ${HOME}/.config/gcloud:/var/bemmoly/gcloud:ro',
  '    environment:',
  '      GOOGLE_APPLICATION_CREDENTIALS: /var/bemmoly/gcloud/application_default_credentials.json',
  'EOF',
  'docker compose up -d',
].join('\n');

export interface VmInput {
  vmName: string;
  vmZone: string;
  vmProject: string;
  account: string;
}

/** The console steps as gcloud: a VM's account changes only while it is stopped. */
export function attachVmCommand(input: VmInput): string {
  const where = `${input.vmName} --zone=${input.vmZone} --project=${input.vmProject}`;
  return [
    `gcloud compute instances stop ${where}`,
    `gcloud compute instances set-service-account ${where} \\`,
    `  --service-account=${input.account} --scopes=cloud-platform`,
    `gcloud compute instances start ${where}`,
  ].join('\n');
}
