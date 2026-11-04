import { createApiClient, type ApiError } from '@bemmoly/api-client';
import { QueryClient } from '@tanstack/react-query';
import { catalogEndpoints } from '../api/catalog.ts';
import { changeRequestsEndpoints } from '../api/change-requests.ts';
import { deliveryEndpoints } from '../api/delivery.ts';
import { environmentEndpoints } from '../api/environments.ts';
import { environmentsV2Endpoints } from '../api/environments-v2.ts';
import { frontDoorEndpoints } from '../api/front-doors.ts';
import { exportEndpoints } from '../api/exports.ts';
import { deploySettingsEndpoints } from '../api/deploy-settings.ts';
import { adoptionEndpoints } from '../api/adoption.ts';
import { pipelineSetupEndpoints } from '../api/pipeline-setup.ts';
import { pipelinesEndpoints } from '../api/pipelines.ts';
import { platformEndpoints } from '../api/platform.ts';
import { rolesEndpoints } from '../api/roles.ts';
import { runtimeEndpoints } from '../api/runtimes.ts';
import { servicesEndpoints } from '../api/services.ts';
import { setupEndpoints } from '../api/setup.ts';
import { shippingEndpoints } from '../api/shipping.ts';
import { variablesEndpoints } from '../api/variables.ts';
import { goToSignIn } from './sign-in.ts';

/**
 * The one API client for Pipelines' web app: the kernel's endpoints (the person, signing out)
 * and Pipelines' own. A 401 at any point means the session ended: back to sign-in, then here.
 */
const client = createApiClient({ onUnauthenticated: () => goToSignIn() });

export const api = {
  ...client,
  pipelines: pipelinesEndpoints(client.http),
  shipping: shippingEndpoints(client.http),
  platform: platformEndpoints(client.http),
  delivery: deliveryEndpoints(client.http),
  environments: environmentEndpoints(client.http),
  variables: variablesEndpoints(client.http),
  runtimes: runtimeEndpoints(client.http),
  frontDoors: frontDoorEndpoints(client.http),
  exports: exportEndpoints(client.http),
  deploySettings: deploySettingsEndpoints(client.http),
  adoption: adoptionEndpoints(client.http),
  catalog: catalogEndpoints(client.http),
  // The simpler Pipelines: one entry per area, so each stream edits only its own api file.
  roles: rolesEndpoints(client.http),
  environmentsV2: environmentsV2Endpoints(client.http),
  setup: setupEndpoints(client.http),
  changeRequests: changeRequestsEndpoints(client.http),
  pipelineSetup: pipelineSetupEndpoints(client.http),
  services: servicesEndpoints(client.http),
};

export type Api = typeof api;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) =>
          count < 1 &&
          !['unauthenticated', 'forbidden', 'not_found'].includes((error as ApiError).code),
      },
    },
  });
}
