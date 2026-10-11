import { createSecretBox, wireWebhooks, type Webhooks } from '@bemmoly/core';
import type { Env, Logger } from '@bemmoly/core/config';
import type { DatabaseConnection } from './database.ts';
import type { IdentityWiring } from './identity.ts';
import type { DataKernel } from './kernel.ts';

export interface WebhooksWiringInput {
  env: Pick<Env, 'BEMMOLY_SECRET_KEY' | 'BEMMOLY_PUBLIC_URL' | 'BEMMOLY_ALLOW_PRIVATE_URLS'>;
  database: DatabaseConnection;
  kernel: DataKernel;
  identity: IdentityWiring;
  logger: Logger;
}

/** Settings › Webhooks and the webhook.deliver job, registered before the jobs service starts. */
export function wireOutgoingWebhooks(input: WebhooksWiringInput): Webhooks {
  const { env, database, kernel } = input;
  return wireWebhooks({
    sql: database.sql,
    jobs: kernel.jobs,
    events: kernel.events,
    authorize: input.identity.authorize,
    secrets: createSecretBox(env.BEMMOLY_SECRET_KEY),
    publicUrl: env.BEMMOLY_PUBLIC_URL,
    allowPrivateUrls: env.BEMMOLY_ALLOW_PRIVATE_URLS,
    logger: input.logger.child({ component: 'webhooks' }),
  });
}
