import type { CloudReach } from './cloud-reach.ts';

/*
 * The one command a project owner runs to let Bemmoly deploy where the person chose, and only
 * there. It turns on the APIs a deploy needs and grants the roles the access check looks for:
 * on a folder or organization the roles are granted once and every project under it inherits
 * them; with picked projects each project gets them. Nothing else is touched.
 */

export const GRANT_ROLES = [
  'roles/run.developer',
  'roles/iam.serviceAccountUser',
  'roles/cloudbuild.builds.editor',
  'roles/artifactregistry.writer',
  'roles/secretmanager.admin',
  'roles/monitoring.viewer',
  'roles/browser',
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

const quote = (value: string) => `"${value.replace(/["\\$`]/g, '\\$&')}"`;

export function grantCommand(reach: CloudReach, principal: string | null): string {
  const lines = [`MEMBER=${quote(memberOf(principal))}`];
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
    'done',
  );
  return lines.join('\n');
}
