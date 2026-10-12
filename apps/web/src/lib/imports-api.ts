import { importEndpoints } from '@bemmoly/api-client/imports';
import { api } from './api.ts';

/** Settings › Import and the wizard's import step: endpoints on the shell's client but out of its first load. */
export const importsApi = importEndpoints(api.http);
