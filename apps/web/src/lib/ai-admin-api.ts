import { aiAdminEndpoints } from '@bemmoly/api-client/ai-admin';
import { api } from './api.ts';

/** Settings › AI and the wizard's AI step: endpoints on the shell's client but out of its first load. */
export const aiAdminApi = aiAdminEndpoints(api.http);
