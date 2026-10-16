#!/usr/bin/env node
/**
 * bemmoly-runner: claims Bemmoly Pipelines jobs and runs them. `--help` explains the options.
 *   node apps/runner/src/main.ts --url https://bemmoly.example.com --pool-token <token>
 *   node apps/runner/src/main.ts split "src/**\/*.test.ts"
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { isBemmolyError } from '@bemmoly/shared';
import packageJson from '../package.json' with { type: 'json' };
import { ControlPlaneClient } from './clients/control-plane.ts';
import { loadLogLevel, loadRunnerConfig, loadSplitConfig } from './config/env.ts';
import { HELP } from './config/help.ts';
import { createLogger, type Logger } from './config/logger.ts';
import { createExecutors } from './executors/index.ts';
import { Agent } from './services/agent.ts';
import { Outbox } from './services/outbox.ts';
import { writeShim } from './services/shim.ts';
import { splitFiles } from './services/split.ts';

const VERSION = packageJson.version;

async function runSplit(args: string[], logger: Logger): Promise<void> {
  const config = loadSplitConfig();
  const client = new ControlPlaneClient({ url: config.BEMMOLY_API_URL, logger });
  const files = await splitFiles(args, process.cwd(), config, client);
  if (files.length > 0) process.stdout.write(`${files.join('\n')}\n`);
}

async function runAgent(args: string[]): Promise<void> {
  const config = loadRunnerConfig(args);
  const logger = createLogger(config.logLevel);
  await mkdir(config.dataDir, { recursive: true, mode: 0o700 });
  const client = new ControlPlaneClient({ url: config.url, logger });
  const binDir = await writeShim(config.dataDir, process.execPath, import.meta.filename);
  const agent = new Agent({
    client,
    logger,
    once: config.once,
    registration: {
      client,
      logger,
      dataDir: config.dataDir,
      url: config.url,
      poolToken: config.poolToken,
      name: config.name,
      version: VERSION,
      labels: config.labels,
    },
    job: {
      executors: createExecutors({
        local: config.local,
        dockerSocket: config.dockerSocket,
        hostEnv: config.hostEnv,
        binDir,
      }),
      outbox: new Outbox(path.join(config.dataDir, 'outbox')),
      workRoot: path.join(config.dataDir, 'work'),
      workspace: config.workspace,
      apiUrl: config.url,
    },
  });
  const onSignal = (signal: NodeJS.Signals) => {
    logger.info({ signal, busy: agent.busy }, agent.busy ? 'stopping after this job' : 'stopping');
    agent.stop();
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  logger.info(
    { version: VERSION, runner: config.name, mode: config.local ? 'local' : 'docker' },
    'runner started',
  );
  await agent.run();
  logger.info('runner stopped');
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(HELP);
    return;
  }
  if (command === '--version' || command === '-v') {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (command === 'split') return runSplit(rest, createLogger(loadLogLevel(), 2));
  return runAgent(argv);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = isBemmolyError(error) || error instanceof Error ? error.message : String(error);
  process.stderr.write(`bemmoly-runner: ${message}\n`);
  process.exitCode = 1;
});
