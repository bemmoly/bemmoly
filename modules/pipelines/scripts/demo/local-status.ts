import type { SqlClient } from '@bemmoly/core';
import { createDockerClient, publishedPort } from '../../server/src/clients/docker.ts';
import { DEMO_APP } from './local.ts';

/* What the local demo shows on a terminal: what runs where, and how to reach it. */

export async function printStatus(sql: SqlClient, out: (line: string) => void): Promise<void> {
  const rows = await sql<
    {
      environment: string;
      version: string | null;
      state: string;
      traffic: number;
      moving: string | null;
    }[]
  >`
    select e.key as environment, c.version, c.state, c.traffic_percent as traffic,
      c.moving_version as moving
    from pipeline_environments e
    left join pipeline_current c on c.environment_id = e.id
      and c.application_id = (select id from pipeline_applications where key = ${DEMO_APP})
    where e.archived_at is null order by e.position`;
  const [connection] = await sql<{ config: { dockerHost?: string } }[]>`
    select config from cloud_connections where provider = 'local' limit 1`;
  const docker = connection?.config.dockerHost
    ? createDockerClient({ host: connection.config.dockerHost })
    : null;
  for (const row of rows) {
    const moving = row.moving ? `, ${row.moving} moving in at ${row.traffic}%` : '';
    let address = '';
    const splitter = await docker?.inspect(`bp-${row.environment}-${DEMO_APP}-splitter`);
    const port = splitter ? publishedPort(splitter, 8080) : null;
    if (port) address = `  curl http://127.0.0.1:${port}/`;
    out(`${row.environment.padEnd(18)} ${row.version ?? '—'} (${row.state}${moving})${address}`);
  }
}

export async function removeContainers(host: string, out: (line: string) => void): Promise<void> {
  const docker = createDockerClient({ host });
  const containers = await docker.list({ 'dev.bemmoly.pipelines': 'true' });
  for (const container of containers) await docker.remove(container.Id);
  out(`Removed ${containers.length} containers.`);
}
