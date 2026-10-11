import { operationsAdminEndpoints } from '@bemmoly/api-client/operations-admin';
import { api } from './api.ts';

/** Settings › Backups, System and Audit log: endpoints on the shell's client but out of its first load. */
export const operationsAdminApi = operationsAdminEndpoints(api.http);
