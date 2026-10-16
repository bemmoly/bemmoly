import {
  forbiddenDetailsSchema,
  type AccessDecision,
  type AskWho,
  type TraceStep,
} from '@bemmoly/module-pipelines/shared';
import type { CliError } from './errors.ts';

/*
 * What bp prints. Plain lines, no colour codes unless the terminal wants them, so output
 * reads the same in a CI log as in a terminal. Every refusal ends with whom to ask.
 */

export interface Output {
  out(line?: string): void;
  err(line?: string): void;
}

export function processOutput(): Output {
  return {
    out: (line = '') => void process.stdout.write(`${line}\n`),
    err: (line = '') => void process.stderr.write(`${line}\n`),
  };
}

/** Collects lines, for tests. */
export function memoryOutput(): Output & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (line = '') => void stdout.push(line),
    err: (line = '') => void stderr.push(line),
  };
}

const EFFECT: Record<TraceStep['effect'], string> = {
  grant: 'grants',
  deny: 'refuses',
  require: 'requires',
  info: 'note',
};

export function traceLines(trace: readonly TraceStep[]): string[] {
  return trace.map((step, index) => `  ${index + 1}. ${step.text} (${EFFECT[step.effect]})`);
}

const askLine = (askWho: AskWho | null) => (askWho ? [`${askWho.label}.`] : []);

export function decisionLines(decision: AccessDecision): string[] {
  return [
    decision.allowed ? 'Allowed' : 'Not allowed',
    decision.sentence,
    ...(decision.trace.length > 0 ? ['', 'Why:', ...traceLines(decision.trace)] : []),
    ...(decision.askWho ? ['', ...askLine(decision.askWho)] : []),
  ];
}

/** An error as the person reads it; a refusal from Pipelines carries its own explanation. */
export function errorLines(error: CliError): string[] {
  const lines = [error.message];
  const forbidden = forbiddenDetailsSchema.safeParse(error.options.body?.details);
  if (forbidden.success) {
    if (forbidden.data.trace.length > 0)
      lines.push('', 'Why:', ...traceLines(forbidden.data.trace));
    lines.push(...(forbidden.data.askWho ? ['', ...askLine(forbidden.data.askWho)] : []));
  } else if (error.options.status === 401) {
    lines.push('Sign in with "bp login", or pass --token.');
  }
  if (error.options.body?.requestId) lines.push(`Request id: ${error.options.body.requestId}`);
  return lines;
}
