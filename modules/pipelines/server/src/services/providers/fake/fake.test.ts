import { describeTargetsConformance } from '../../../testing/provider-conformance.ts';
import { createFakeProvider } from './index.ts';

const release = (version: string) => ({
  id: `00000000-0000-7000-8000-00000000000${version.length}`,
  version,
  commitSha: 'a1c9e3f',
  imageRepository: null,
  imageDigests: {},
  resolvedConfig: {},
});

describeTargetsConformance('fake', async () => {
  const provider = createFakeProvider();
  return {
    provider,
    target: {
      connection: {
        id: 'c',
        provider: 'gcp',
        name: 'Fake',
        layout: 'per-environment',
        boundaryRef: null,
        config: {},
      },
      environment: { id: 'e', key: 'prod', class: 'prod', region: null },
      account: null,
      application: { id: 'a', key: 'checkout-api', runtime: 'container-service' },
    },
    stable: release('v1'),
    next: release('v2.0'),
  };
});
