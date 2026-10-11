import { webhookEndpoints } from '@bemmoly/api-client/webhooks';
import { api } from './api.ts';

/** Settings › Webhooks' endpoints, on the shell's client but out of its first load. */
export const webhooksApi = webhookEndpoints(api.http);
