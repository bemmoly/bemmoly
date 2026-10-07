/**
 * bemmoly-system: backups, restore, rollback planning and health from the command line.
 * The host's `bemmoly` CLI and the updater run it inside the app container:
 *
 *   docker compose exec bemmoly bemmoly-system backup --kind manual
 *
 * Output is human-readable, or one JSON document with --json. Logs go to stderr.
 */
import { parseArgs } from 'node:util';
import { COMMANDS } from './system/commands.ts';
import { printResult } from './system/print.ts';
import { createRuntime, UsageError } from './system/runtime.ts';

const USAGE = `Usage: bemmoly-system <command> [options]

  backup [--kind manual|pre_upgrade|scheduled] [--if-older-than 36h]
  backups [--limit 50]                 list backups, newest first
  verify <set|id> [--drill]            checksums and pg_restore --list; --drill restores into a temp db
  restore <set|id|/path|s3://url>      replace the live database (maintenance mode while it runs);
                                       refused during an update or rollback (--as-updater: the
                                       updater's own restore, from inside its lock)
  mount <set|id|/path|s3://url>        attach a backup read-only as a second database
  unmount <database>
  rollback-plan [--prefer-restore]     the mode a rollback would use and what it discards
  status                               version, database size, queue depth, last backup
  health [--tls auto|internal]         the setup wizard's checks with fixes
  updates                              current version, available update, rollback plan
  update-check                         fetch the release manifest now
  prune                                apply backup retention now
  sync-index                           add rows for backup sets found on disk or in S3
  maintenance on <reason> [message] [--step text] | maintenance off

Options: --json  print one JSON document`;

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean' },
      kind: { type: 'string' },
      'if-older-than': { type: 'string' },
      limit: { type: 'string' },
      drill: { type: 'boolean' },
      'prefer-restore': { type: 'boolean' },
      'as-updater': { type: 'boolean' },
      tls: { type: 'string' },
      step: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [name, ...args] = positionals;
  const command = name ? COMMANDS[name] : undefined;
  if (values.help || !command) {
    process.stdout.write(`${USAGE}\n`);
    return values.help ? 0 : 2;
  }
  // The host CLI runs this through `compose exec -T`, so stderr is not a terminal even when
  // a person is reading: without --json, the caller is a person either way.
  const runtime = await createRuntime({
    humanLogs: Boolean(process.stderr.isTTY) || !values.json,
  });
  try {
    const result = await command(runtime, {
      args,
      flags: values,
      log: (line) => process.stderr.write(`${line}\n`),
    });
    printResult(name ?? '', result, Boolean(values.json));
    return typeof process.exitCode === 'number' ? process.exitCode : 0;
  } finally {
    await runtime.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`bemmoly-system: ${message}\n`);
    process.exit(error instanceof UsageError ? 2 : 1);
  },
);
