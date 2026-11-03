import { describe, expect, it } from 'vitest';
import { EMPTY_WIF, wifCommands } from './wif-commands.ts';

describe('the workload identity commands', () => {
  it('fills in the project and keeps placeholders for what is not typed yet', () => {
    const commands = wifCommands({ ...EMPTY_WIF, projectId: 'example-tools' });
    expect(commands).toContain('bemmoly@example-tools.iam.gserviceaccount.com');
    expect(commands).toContain(
      'projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/bemmoly/*',
    );
    expect(commands).toContain('providers create-oidc');
    expect(commands).toContain('--output-file=bemmoly-wif.json');
  });

  it('uses an AWS provider and source when Bemmoly runs on AWS', () => {
    const commands = wifCommands({ ...EMPTY_WIF, runsOn: 'aws', awsAccount: '123456789012' });
    expect(commands).toContain('providers create-aws');
    expect(commands).toContain('--account-id=123456789012');
    expect(commands).toContain(' --aws ');
  });
});
