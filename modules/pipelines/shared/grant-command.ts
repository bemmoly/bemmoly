import type { CloudReach } from './cloud-reach.ts';

/*
 * The one command a project owner runs to let Bemmoly deploy where the person chose, and only
 * there, holding the least it needs (docs/pipelines/google-cloud-access.md). It turns on the
 * APIs a deploy needs and grants what the access check looks for. Project roles go on a
 * folder or organization once, so every project under it inherits them, or on each picked
 * project. The rest is narrower than a project and is granted in each project: Service
 * Account User on the one account services run as, and a custom role holding only the Secret
 * Manager permissions Bemmoly uses. Nothing else is touched.
 */

/**
 * Cloud Run Admin rather than Developer, as in a landing zone: a service marked public needs
 * its invoker policy set, which Developer cannot do. Both carry resourcemanager.projects.get,
 * so Browser is not needed to read a project's number or name.
 */
export const GRANT_ROLES = [
  'roles/run.admin',
  'roles/cloudbuild.builds.editor',
  'roles/monitoring.viewer',
] as const;

/** Lets Bemmoly start services that run as one account; granted on that account alone. */
export const ACT_AS_ROLE = 'roles/iam.serviceAccountUser';

/**
 * What Bemmoly does with Secret Manager: create a secret, add and read its versions, and let
 * one reader at a time access it. Secret Manager Admin is the only predefined role with both
 * create and setIamPolicy, and it can also delete and destroy every secret in the project.
 */
export const SECRETS_ROLE_ID = 'bemmolySecrets';
export const SECRETS_PERMISSIONS = [
  'secretmanager.secrets.create',
  'secretmanager.secrets.get',
  'secretmanager.secrets.getIamPolicy',
  'secretmanager.secrets.setIamPolicy',
  'secretmanager.versions.add',
  'secretmanager.versions.get',
  'secretmanager.versions.access',
] as const;

export const GRANT_APIS = [
  'run.googleapis.com',
  'cloudbuild.googleapis.com',
  'artifactregistry.googleapis.com',
  'secretmanager.googleapis.com',
  'monitoring.googleapis.com',
] as const;

/** Stands in for who Bemmoly signs in as until the access check has said. */
export const PRINCIPAL_PLACEHOLDER = 'BEMMOLY_SIGNS_IN_AS';

/** An IAM member for a principal: a service account, a person, or a federated identity. */
export function memberOf(principal: string | null): string {
  if (!principal) return `serviceAccount:${PRINCIPAL_PLACEHOLDER}`;
  if (principal.includes('://')) return principal;
  if (principal.includes(':')) return principal;
  return principal.endsWith('.gserviceaccount.com')
    ? `serviceAccount:${principal}`
    : `user:${principal}`;
}

/** Services run as Compute Engine's default account unless the project names another. */
export const defaultRuntimeAccount = (projectNumber: string) =>
  `${projectNumber}-compute@developer.gserviceaccount.com`;

const quote = (value: string) => `"${value.replace(/["\\$`]/g, '\\$&')}"`;

/** The lines run in each project, with $PROJECT set: the grants narrower than a project. */
function perProject(runtimeAccounts: Readonly<Record<string, string>>): string[] {
  const role = `projects/$PROJECT/roles/${SECRETS_ROLE_ID}`;
  const named = Object.entries(runtimeAccounts);
  const lookUp = `RUNTIME="$(gcloud projects describe "$PROJECT" --format="value(projectNumber)")-compute@developer.gserviceaccount.com"`;
  const runtime =
    named.length === 0
      ? [lookUp]
      : [
          'case "$PROJECT" in',
          ...named.map(([project, email]) => `  ${project}) RUNTIME=${quote(email)} ;;`),
          `  *) ${lookUp} ;;`,
          'esac',
        ];
  return [
    `gcloud iam roles create ${SECRETS_ROLE_ID} --project="$PROJECT" --title="Bemmoly secrets" --permissions="$SECRETS" --stage=GA --quiet 2>/dev/null ||`,
    `  gcloud iam roles update ${SECRETS_ROLE_ID} --project="$PROJECT" --permissions="$SECRETS" --quiet`,
    `gcloud projects add-iam-policy-binding "$PROJECT" --member="$MEMBER" --role="${role}" --condition=None`,
    ...runtime,
    `gcloud iam service-accounts add-iam-policy-binding "$RUNTIME" --project="$PROJECT" --member="$MEMBER" --role=${ACT_AS_ROLE}`,
  ];
}

const indent = (lines: string[], by: string) => lines.map((line) => `${by}${line}`);

/**
 * `runtimeAccounts` names the account services run as in a picked project, where it is not
 * the default one; projects missing from it get the default, looked up with gcloud.
 */
export function grantCommand(
  reach: CloudReach,
  principal: string | null,
  runtimeAccounts: Readonly<Record<string, string>> = {},
): string {
  const lines = [
    `MEMBER=${quote(memberOf(principal))}`,
    `SECRETS=${SECRETS_PERMISSIONS.join(',')}`,
  ];
  const roles = GRANT_ROLES.join(' ');
  const apis = GRANT_APIS.join(' ');
  if (reach.kind === 'folder') {
    const [kind, id] = reach.parent.split('/');
    const scope = kind === 'organizations' ? 'organizations' : 'resource-manager folders';
    const filter = kind === 'organizations' ? 'parent.type=organization' : 'parent.type=folder';
    lines.push(
      `for ROLE in ${roles}; do`,
      `  gcloud ${scope} add-iam-policy-binding ${id} --member="$MEMBER" --role="$ROLE" --condition=None`,
      'done',
      `for PROJECT in $(gcloud projects list --filter="${filter} parent.id=${id}" --format="value(projectId)"); do`,
      `  gcloud services enable ${apis} --project="$PROJECT"`,
      ...indent(perProject({}), '  '),
      'done',
    );
    return lines.join('\n');
  }
  lines.push(
    `for PROJECT in ${reach.projects.join(' ')}; do`,
    `  gcloud services enable ${apis} --project="$PROJECT"`,
    `  for ROLE in ${roles}; do`,
    `    gcloud projects add-iam-policy-binding "$PROJECT" --member="$MEMBER" --role="$ROLE" --condition=None`,
    '  done',
    ...indent(perProject(runtimeAccounts), '  '),
    'done',
  );
  return lines.join('\n');
}
