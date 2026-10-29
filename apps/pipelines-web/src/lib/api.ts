import { createApiClient, type ApiError } from '@bemmoly/api-client';
import { QueryClient } from '@tanstack/react-query';
import { deliveryEndpoints } from '../api/delivery.ts';
import { environmentEndpoints } from '../api/environments.ts';
import { pipelinesEndpoints } from '../api/pipelines.ts';
import { platformEndpoints } from '../api/platform.ts';
import { runtimeEndpoints } from '../api/runtimes.ts';
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
