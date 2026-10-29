import { createArtifactRegistryClient } from './artifact-registry.ts';
import { createBillingClient } from './billing.ts';
import { createBudgetsClient } from './budgets.ts';
import { createCloudBuildClient } from './cloud-build.ts';
import { createCloudRunClient } from './cloud-run.ts';
import { createComputeClient } from './compute.ts';
import { createContainerClient } from './container.ts';
import { createGcpHttp, type GcpTokenSource, type GcpTransport } from './http.ts';
import { createIamCredentialsClient } from './iam-credentials.ts';
import { createIamClient } from './iam.ts';
import { createLoggingClient } from './logging.ts';
import { createMonitoringClient } from './monitoring.ts';
import { DEFAULT_POLL, type PollOptions } from './operations.ts';
import { createResourceManagerClient } from './resource-manager.ts';
import { createSecretManagerClient } from './secret-manager.ts';
import { createServiceUsageClient } from './service-usage.ts';
import { createStsClient } from './sts.ts';

/** Every Google Cloud API client, sharing one identity, transport and polling budget. */

export interface GcpClientOptions {
  tokens: GcpTokenSource;
  transport?: GcpTransport;
  timeoutMs?: number;
  poll?: Partial<PollOptions>;
}

export function createGcpClients(options: GcpClientOptions) {
  const http = createGcpHttp(options);
  const poll = { ...DEFAULT_POLL, ...options.poll };
  return {
    resourceManager: createResourceManagerClient(http, poll),
    billing: createBillingClient(http),
    budgets: createBudgetsClient(http),
    serviceUsage: createServiceUsageClient(http, poll),
    iam: createIamClient(http),
    iamCredentials: createIamCredentialsClient(http),
    sts: createStsClient(options),
    run: createCloudRunClient(http, poll),
    artifactRegistry: createArtifactRegistryClient(http, poll),
    secretManager: createSecretManagerClient(http),
    monitoring: createMonitoringClient(http),
    cloudBuild: createCloudBuildClient(http),
    compute: createComputeClient(http, poll),
    logging: createLoggingClient(http),
    container: createContainerClient(http, poll),
    /** The identity these clients act as, for APIs outside Google's, such as a cluster's. */
    tokens: options.tokens,
  };
}

export type GcpClients = ReturnType<typeof createGcpClients>;

export { GcpApiError, type GcpTokenSource, type GcpTransport } from './http.ts';
export { createTokenSource, gcpCredentialsSchema, type GcpCredentials } from './auth.ts';
export { impersonatedTokens } from './iam-credentials.ts';
export { serviceAccountEmail } from './iam.ts';
export { hasBinding, serviceAccountMember, withBinding, type IamPolicy } from './policy.ts';
export { LATEST_TARGET, REVISION_TARGET, runServiceName, type RunService } from './cloud-run.ts';
export { dockerHostPath, parseDockerPath, repositoryName } from './artifact-registry.ts';
export type { PollOptions } from './operations.ts';
export {
  gatewayApiOn,
  gkeClusterName,
  type ContainerClient,
  type GkeCluster,
  type GkeOperation,
} from './container.ts';
