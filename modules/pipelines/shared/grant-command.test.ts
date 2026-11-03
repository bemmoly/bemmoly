import { describe, expect, it } from 'vitest';
import { cloudReachSchema } from './cloud-reach.ts';
import { grantCommand, memberOf, PRINCIPAL_PLACEHOLDER } from './grant-command.ts';

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
    expect(command).not.toContain('gcloud projects add-iam-policy-binding');
  });

  it('grants in each picked project and nowhere else', () => {
    const reach = cloudReachSchema.parse({
      kind: 'projects',
      projects: ['example-dev', 'example-prod'],
    });
    const command = grantCommand(reach, 'bemmoly@tools.iam.gserviceaccount.com');
    expect(command).toContain('for PROJECT in example-dev example-prod; do');
    expect(command).toContain('roles/run.developer');
    expect(command).not.toContain('folders');
  });
});
