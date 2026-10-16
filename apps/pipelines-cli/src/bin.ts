#!/usr/bin/env node
import { defaultContext } from './cli/context.ts';
import { CliError } from './cli/errors.ts';
import { main } from './cli/main.ts';
import { processOutput } from './cli/output.ts';
import { readEnv } from './config/env.ts';

const output = processOutput();
try {
  process.exitCode = await main(defaultContext(readEnv(), output), process.argv.slice(2));
} catch (error) {
  // Only a bad environment variable reaches here: everything else is handled in main.
  output.err(
    error instanceof CliError ? error.message : `bp cannot start: ${(error as Error).message}`,
  );
  process.exitCode = 2;
}
