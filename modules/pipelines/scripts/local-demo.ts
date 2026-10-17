#!/usr/bin/env node
/**
 * pnpm --filter @bemmoly/module-pipelines demo:local <command> [--docker unix:///…]
 *
 *   setup     point every environment at this machine's Docker, shorten the rollout timings,
 *             ship a good pricing-svc release through Dev and Staging as one of its team,
 *             and ask for Prod: it then waits for your approval in For you
 *   bad       ship a release that fails a third of requests in Prod asia-south1 the same way;
 *             approve it and watch its canary roll back by itself
 *   approve   approve the open Prod promotion as another engineer of the owning team
 *   continue  carry on with a paused canary (what Continue on the deployment page does)
 *   drive     keep the shipping engine moving every two seconds (when the server is not running)
 *   status    what runs where, and the local address of each environment
 *   undo      point the environments back at the simulated cloud and stop the containers
 *
 * Needs the Pipelines demo seed (seed:demo) and Docker or Colima.
 */
import { parseArgs } from 'node:util';
import { createSqlClient } from '@bemmoly/core';
import { loadSeedConfig } from './demo/config.ts';
import {
  DEMO_APP,
  demoPeople,
  demoShipping,
  dockerHost,
  driveUntilSettled,
  makeReleases,
  pointAtDocker,
  pointBack,
} from './demo/local.ts';
import { printStatus, removeContainers } from './demo/local-status.ts';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { docker: { type: 'string' } },
  allowPositionals: true,
});
const command = positionals[0] ?? 'status';
const out = (line: string) => process.stdout.write(`[demo] ${line}\n`);

const sql = createSqlClient(loadSeedConfig().databaseUrl, {
  applicationName: 'bemmoly-pipelines-local-demo',
  maxConnections: 4,
});
const { shipping, as } = demoShipping(sql);

async function ship(releaseId: string, version: string) {
  const { author } = await demoPeople(sql);
  const requester = as(author.id);
  const name = author.name;
  for (const to of ['dev', 'staging']) {
    out(`${name} promotes ${DEMO_APP} ${version} to ${to}`);
    const { promotion } = await shipping.requestPromotion(requester, {
      release: releaseId,
      to,
      mode: 'approval',
    });
    await driveUntilSettled(sql, shipping, promotion.id, (line) => out(`  ${to}: ${line}`));
  }
  const { promotion } = await shipping.requestPromotion(requester, {
    release: releaseId,
    to: 'prod',
    mode: 'approval',
  });
  out(
    `${name} asks for Prod: ${promotion.state}. Approve it in Pipelines › For you, or run "demo:local approve".`,
  );
}

try {
  if (command === 'setup') {
    const docker = dockerHost(values.docker);
    await pointAtDocker(sql, docker);
    out(
      `Environments now deploy to Docker at ${docker}; canary steps hold 1 minute, samples every 10 seconds, deploy windows lifted and bakes cut to a minute until undo.`,
    );
    out('Restart the server if it is running, so it reads the shorter timings.');
    const { good } = await makeReleases(sql, (await demoPeople(sql)).author.id);
    await ship(good.id, good.version);
  } else if (command === 'bad') {
    const { bad } = await makeReleases(sql, (await demoPeople(sql)).author.id);
    await ship(bad.id, bad.version);
  } else if (command === 'approve') {
    const { approver } = await demoPeople(sql);
    const approverCtx = as(approver.id);

    const open = await sql<{ id: string }[]>`
      select p.id from pipeline_promotions p join pipeline_applications a on a.id = p.application_id
      where a.key = ${DEMO_APP} and p.state = 'awaiting_approval' order by p.created_at desc limit 1`;
    for (const { id } of open) {
      const promotion = await shipping.getPromotion(approverCtx, id);
      const approved = await shipping.decide(approverCtx, id, {
        decision: 'approved',
        releaseDigest: promotion.release.digest,
      });
      out(
        `${approver.name} approved ${promotion.release.version} to ${promotion.environment.name}: ${approved.state}`,
      );
      await driveUntilSettled(sql, shipping, id, (line) => out(`  ${line}`));
    }
    if (open.length === 0) out('Nothing is waiting for approval.');
  } else if (command === 'continue') {
    const { approver } = await demoPeople(sql);
    const paused = await sql<{ id: string; promotion_id: string | null }[]>`
      select d.id, d.promotion_id from pipeline_deployments d
      join pipeline_applications a on a.id = d.application_id
      where a.key = ${DEMO_APP} and d.state = 'waiting' order by d.created_at desc limit 1`;
    const [row] = paused;
    if (!row) out('No canary is paused.');
    else {
      await shipping.resume(as(approver.id), row.id, { decision: 'continue', reason: 'Carry on' });
      out(`${approver.name} carries on with the paused canary`);
      if (row.promotion_id) {
        await driveUntilSettled(sql, shipping, row.promotion_id, (line) => out(`  ${line}`));
      }
    }
  } else if (command === 'drive') {
    out('Driving the shipping engine; Ctrl+C stops.');
    for (;;) {
      await shipping.engine.sweep();
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } else if (command === 'status') {
    await printStatus(sql, out);
  } else if (command === 'undo') {
    await pointBack(sql);
    await removeContainers(dockerHost(values.docker), out);
    out('Environments point at the simulated cloud again.');
  } else {
    process.stderr.write(
      `Unknown command ${command}. Use setup, bad, approve, continue, drive, status or undo.\n`,
    );
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
