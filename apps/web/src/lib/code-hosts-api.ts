import { codeHostEndpoints } from '@bemmoly/api-client/code-hosts';
import { api } from './api.ts';

/** Settings › Code hosts and the GitHub app return: endpoints on the shell's client but out of its first load. */
export const codeHostsApi = codeHostEndpoints(api.http);
