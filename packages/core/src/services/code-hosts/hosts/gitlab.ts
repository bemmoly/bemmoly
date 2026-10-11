import { randomUUID } from 'node:crypto';
import { ValidationError } from '@bemmoly/shared';
import { z } from 'zod';
import { createCodeHostRest } from '../../../clients/code-host-rest.ts';
import { bodyDigest, safeEqual } from '../signature.ts';
import {
  headerOf,
  withoutTrailingSlashes,
  type CodeHostDriver,
  type HostApiOptions,
  type HostConnection,
} from '../types.ts';
import { gitlabRequestSchema, parseGitlabEvent, requestActivity } from './gitlab-events.ts';

/*
 * GitLab, on gitlab.com and self-managed. A delivery carries the webhook's secret token in
 * X-Gitlab-Token, compared in constant time before the body is read. The API is called with
 * a project or group access token.
 */

export function gitlabApiUrl(baseUrl: string | null): string {
  return `${withoutTrailingSlashes(baseUrl ?? 'https://gitlab.com')}/api/v4`;
}

const userSchema = z.object({ username: z.string() });

function gitlabApi(connection: HostConnection, options: HostApiOptions) {
  const token = connection.secrets.token;
  const rest = () => {
    if (!token) throw new ValidationError('No access token is saved for this host');
    return createCodeHostRest({
      ...options,
      baseUrl: gitlabApiUrl(connection.baseUrl),
      headers: { 'private-token': token, 'user-agent': 'Bemmoly' },
    });
  };
  return {
    async check() {
      const user = userSchema.parse(await rest().getJson('user'));
      return `Connected as ${user.username}`;
    },
    async recentRequests(repository: string, since: Date, limit: number) {
      const requests = z.array(gitlabRequestSchema).parse(
        await rest().getJson(`projects/${encodeURIComponent(repository)}/merge_requests`, {
          updated_after: since.toISOString(),
          order_by: 'updated_at',
          sort: 'desc',
          per_page: Math.min(100, limit),
        }),
      );
      const now = new Date().toISOString();
      return requests.map((request) => requestActivity(repository, request, now));
    },
  };
}

export const gitlabHost: CodeHostDriver = {
  kind: 'gitlab',
  label: 'GitLab',
  cloudUrl: 'https://gitlab.com',
  verify(request, webhookSecret) {
    const presented = headerOf(request, 'x-gitlab-token');
    return presented !== undefined && safeEqual(presented, webhookSecret);
  },
  deliveryId: (request) =>
    headerOf(request, 'x-gitlab-event-uuid') ??
    headerOf(request, 'x-gitlab-webhook-uuid') ??
    bodyDigest(request.body),
  parse(request) {
    const event = headerOf(request, 'x-gitlab-event');
    if (!event) throw new ValidationError('The delivery does not name a GitLab event');
    if (event === 'Bemmoly Test Hook') {
      return { event, action: null, summary: 'Test delivery', activities: [], ping: true };
    }
    return parseGitlabEvent(event, request.body, new Date().toISOString());
  },
  ping(webhookSecret) {
    return {
      body: Buffer.from(JSON.stringify({ object_kind: 'test' })),
      headers: {
        'content-type': 'application/json',
        'x-gitlab-event': 'Bemmoly Test Hook',
        'x-gitlab-event-uuid': `test-${randomUUID()}`,
        'x-gitlab-token': webhookSecret,
      },
    };
  },
  api: gitlabApi,
};
