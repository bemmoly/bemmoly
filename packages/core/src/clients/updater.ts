import { updaterStatusSchema, type RollbackMode, type UpdaterStatus } from '@bemmoly/shared';
import { requestJson } from './http-json.ts';

export interface UpdaterClientConfig {
  /** e.g. http://updater:8090 on the Compose network. */
  baseUrl: string;
  token: string;
  timeoutMs?: number;
}

/** The app's side of the updater API; the updater accepts only these three calls. */
export interface UpdaterClient {
  status(): Promise<UpdaterStatus>;
  update(tag: string): Promise<void>;
  rollback(input: { expectedMode?: RollbackMode; preferRestore: boolean }): Promise<void>;
}

export function createUpdaterClient(config: UpdaterClientConfig): UpdaterClient {
  const timeoutMs = config.timeoutMs ?? 10_000;
  const headers = { authorization: `Bearer ${config.token}` };
  const url = (path: string) => new URL(path, config.baseUrl).toString();
  return {
    async status() {
      const body = await requestJson({ url: url('/v1/status'), headers, timeoutMs });
      return updaterStatusSchema.parse(body);
    },
    async update(tag) {
      await requestJson({
        url: url('/v1/update'),
        method: 'POST',
        headers,
        body: { tag },
        timeoutMs,
      });
    },
    async rollback(input) {
      await requestJson({
        url: url('/v1/rollback'),
        method: 'POST',
        headers,
        body: input,
        timeoutMs,
      });
    },
  };
}
