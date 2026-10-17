import { appendFile, glob, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CliError } from '@bemmoly/pipelines-cli/ci';
import { readActionEnv, type ActionEnv } from './config/env.ts';
import { runAction, type ActionIo } from './run.ts';

/** GitHub's workflow commands escape these so a message cannot start another command. */
const escape = (text: string) =>
  text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');

function runnerIo(env: ActionEnv): ActionIo {
  const workspace = env.GITHUB_WORKSPACE ?? process.cwd();
  return {
    async findReports(patterns) {
      const found = new Set<string>();
      for (const pattern of patterns) {
        for await (const path of glob(pattern, { cwd: workspace }))
          found.add(resolve(workspace, path));
      }
      return [...found].sort();
    },
    readFile: (path) => readFile(path, 'utf8'),
    info: (line) => void process.stdout.write(`${line}\n`),
    async setOutput(name, value) {
      if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `${name}=${value}\n`);
    },
    async summary(markdown) {
      if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, markdown);
    },
  };
}

try {
  const env = readActionEnv();
  await runAction(env, runnerIo(env));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(`::error title=Bemmoly release::${escape(message)}\n`);
  const details = error instanceof CliError ? error.options.body?.details : undefined;
  if (details) process.stdout.write(`${JSON.stringify(details, null, 2)}\n`);
  process.exitCode = 1;
}
