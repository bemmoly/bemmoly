import type { PipelinesHarness } from './harness.ts';
import type { PipelinesHttp } from './http.ts';

/*
 * Somewhere for secrets to live: Google Cloud attached with a Dev project, a Prod project and
 * a CI project, the catalog fixture's Dev and Prod pointed at the first two. Staging keeps no
 * project, so a secret there has nowhere to go. The simulated cloud stands in for Google Cloud.
 */

export interface SecretsPlace {
  connection: string;
  accounts: { dev: string; prod: string; ci: string };
}

async function ok(response: Promise<{ statusCode: number; json(): unknown; body: string }>) {
  const answer = await response;
  if (answer.statusCode >= 300) throw new Error(`${answer.statusCode}: ${answer.body}`);
  return answer.json() as { id: string };
}

export async function attachSecretsPlace(
  harness: PipelinesHarness,
  api: PipelinesHttp,
  options: { chooseCi?: boolean } = {},
): Promise<SecretsPlace> {
  const admin = harness.users.admin;
  const connection = await ok(
    api.send('POST', '/clouds', admin, {
      provider: 'gcp',
      name: 'Shop Google Cloud',
      mode: 'attached',
      signIn: 'application_default',
    }),
  );
  const attach = (externalId: string) =>
    ok(api.send('POST', `/clouds/${connection.id}/accounts`, admin, { externalId }));
  const accounts = {
    dev: (await attach('acme-shop-dev')).id,
    prod: (await attach('acme-shop-prod')).id,
    ci: (await attach('acme-shop-ci')).id,
  };
  await ok(api.send('PATCH', '/environments/dev', admin, { cloudAccountId: accounts.dev }));
  await ok(
    api.send('PATCH', '/environments/prod-asia-south1', admin, { cloudAccountId: accounts.prod }),
  );
  if (options.chooseCi !== false) {
    await ok(api.send('PATCH', `/clouds/${connection.id}`, admin, { ciAccountId: accounts.ci }));
  }
  return { connection: connection.id, accounts };
}

/** Every text and jsonb value in the database that contains `needle`, as "table.column". */
export async function columnsHolding(harness: PipelinesHarness, needle: string) {
  const columns = await harness.sql<{ table_name: string; column_name: string }[]>`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'
      and data_type in ('text', 'jsonb', 'json', 'character varying', 'ARRAY')
    order by table_name, column_name`;
  const found: string[] = [];
  for (const { table_name: table, column_name: column } of columns) {
    const [row] = await harness.sql<{ n: number }[]>`
      select count(*)::int as n from ${harness.sql(table)}
      where ${harness.sql(column)}::text like ${`%${needle}%`}`;
    if ((row?.n ?? 0) > 0) found.push(`${table}.${column}`);
  }
  return { searched: columns.length, found };
}
