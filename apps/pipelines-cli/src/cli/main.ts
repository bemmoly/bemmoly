import { login, logout, whoami } from '../commands/auth.ts';
import { lintCommand } from '../commands/lint.ts';
import { releaseCommand } from '../commands/release.ts';
import { logsCommand, runCommand } from '../commands/runs.ts';
import { promoteCommand, rollbackCommand } from '../commands/ship.ts';
import { whyCommand } from '../commands/why.ts';
import type { Context } from './context.ts';
import { CliError } from './errors.ts';
import { errorLines } from './output.ts';

/*
 * bp's front door: the command name picks a handler, every handler returns an exit code,
 * and every error ends here, printed in plain words. Nothing below prints a stack trace.
 */

export const VERSION = '1.1.0';

type Command = (ctx: Context, argv: readonly string[]) => Promise<number>;

const COMMANDS: Record<string, Command> = {
  login,
  logout,
  whoami,
  run: runCommand,
  logs: logsCommand,
  release: releaseCommand,
  promote: promoteCommand,
  rollback: rollbackCommand,
  why: whyCommand,
  lint: lintCommand,
};

export const HELP = `bp: Bemmoly Pipelines from a terminal or CI

Usage: bp <command> [options]

  login [--server URL] [--token TOKEN]   Sign in with a device code, or keep an API token
  logout                                 Forget the stored sign-in
  whoami                                 Who bp acts as
  run <application> [--ref REF] [--commit SHA] [--input k=v] [--var K=V] [-f]
                                         Start a pipeline; -f follows it to the end
  logs <run|job> [-f] [--tail N]         Print a log; -f follows it
  release create --application KEY --commit SHA (--image sha256:… | --images platform=sha256:…)
                 [--version V] [--ref REF] [--junit FILE]… [--notes TEXT]
                                         Register a release built by another CI
  promote <application> --to ENV [--release VERSION]
                                         Ask for a release to go to an environment
  rollback <application> --env ENV [--to VERSION] [--reason TEXT]
                                         Put an environment back on its previous release
  why <action> <application> [--env ENV] [--user ID]
                                         Explain an access decision
  lint [paths…]                          Check .bemmoly/application.yaml and pipeline files offline

Every command that talks to a server takes --server and --token; otherwise they come from
BEMMOLY_PIPELINES_URL and BEMMOLY_PIPELINES_TOKEN, then from "bp login".`;

export async function main(ctx: Context, argv: readonly string[]): Promise<number> {
  const [name, ...rest] = argv;
  if (!name || name === 'help' || name === '--help' || name === '-h') {
    ctx.output.out(HELP);
    return name ? 0 : 2;
  }
  if (name === 'version' || name === '--version') {
    ctx.output.out(VERSION);
    return 0;
  }
  const command = COMMANDS[name];
  if (!command) {
    ctx.output.err(`bp has no command "${name}". Run "bp help" for the list.`);
    return 2;
  }
  try {
    return await command(ctx, rest);
  } catch (error) {
    if (error instanceof CliError) {
      for (const line of errorLines(error)) ctx.output.err(line);
      return error.exitCode;
    }
    ctx.output.err(`bp stopped on an unexpected error: ${(error as Error).message}`);
    return 1;
  }
}
