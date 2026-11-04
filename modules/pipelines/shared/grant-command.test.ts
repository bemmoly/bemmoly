import { describe, expect, it } from 'vitest';
import { cloudReachSchema } from './cloud-reach.ts';
import {
  grantCommand,
  memberOf,
  PRINCIPAL_PLACEHOLDER,
  SECRETS_PERMISSIONS,
} from './grant-command.ts';

describe('the grant command', () => {
  it('names who Bemmoly signs in as, or a placeholder until the check says', () => {
    expect(memberOf('bemmoly@tools.iam.gserviceaccount.com')).toBe(
      'serviceAccount:bemmoly@tools.iam.gserviceaccount.com',
    );
    expect(memberOf('someone@example.com')).toBe('user:someone@example.com');
    expect(memberOf(null)).toBe(`serviceAccount:${PRINCIPAL_PLACEHOLDER}`);
  });

  it('grants once on a folder, and turns APIs on in each of its projects', () => {
    const reach = cloudReachSchema.parse({ kind: 'folder', parent: '417302018845' });
    const command = grantCommand(reach, null);
    expect(command).toContain(
      'gcloud resource-manager folders add-iam-policy-binding 417302018845',
    );
    expect(command).toContain('parent.id=417302018845');
    // Project roles are inherited from the folder; only the narrower grants go per project.
    expect(command).not.toMatch(/gcloud projects add-iam-policy-binding .*--role="\$ROLE"/);
    expect(command).toContain('--role="projects/$PROJECT/roles/bemmolySecrets"');
    expect(command).toContain('gcloud iam service-accounts add-iam-policy-binding "$RUNTIME"');
  });

  it('grants in each picked project and nowhere else', () => {
    const reach = cloudReachSchema.parse({
      kind: 'projects',
      projects: ['example-dev', 'example-prod'],
    });
    const command = grantCommand(reach, 'bemmoly@tools.iam.gserviceaccount.com');
    expect(command).toContain('for PROJECT in example-dev example-prod; do');
    expect(command).toContain('roles/run.admin');
    expect(command).not.toContain('folders');
  });

  it('grants nothing project-wide that a narrower resource can hold', () => {
    const reach = cloudReachSchema.parse({ kind: 'projects', projects: ['example-prod'] });
    const command = grantCommand(reach, null);
    for (const broad of [
      'roles/iam.serviceAccountUser"',
      'roles/secretmanager.admin',
      'roles/browser',
      'roles/artifactregistry.writer',
      'roles/run.developer',
    ]) {
      expect(command).not.toContain(broad);
    }
    // Service Account User goes on the account services run as, looked up by project number.
    expect(command).toContain(
      'RUNTIME="$(gcloud projects describe "$PROJECT" --format="value(projectNumber)")-compute@developer.gserviceaccount.com"',
    );
    expect(command).toContain(
      `gcloud iam roles create bemmolySecrets --project="$PROJECT" --title="Bemmoly secrets" --permissions="$SECRETS"`,
    );
    expect(command).toContain(`SECRETS=${SECRETS_PERMISSIONS.join(',')}`);
  });

  it('uses the runtime account a project names, and the default for the rest', () => {
    const reach = cloudReachSchema.parse({
      kind: 'projects',
      projects: ['example-dev', 'example-prod'],
    });
    const command = grantCommand(reach, null, {
      'example-prod': 'storefront@example-prod.iam.gserviceaccount.com',
    });
    expect(command).toContain(
      '    example-prod) RUNTIME="storefront@example-prod.iam.gserviceaccount.com" ;;',
    );
    expect(command).toContain('    *) RUNTIME="$(gcloud projects describe');
  });
});
